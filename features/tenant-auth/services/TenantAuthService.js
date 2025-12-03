const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const AppError = require('../../../modules/AppError');
const logger = require('../../../modules/logger');
const TenantUserRepo = require('../repository/tenantUser.repository');
const TillSessionRepo = require('../repository/tillSession.repository');
const { sendEmail } = require('../../../modules/helper');
const { hasTenantScope, branchGuard } = require('./tenantGuards');
const PosTerminalService = require('../../pos/services/PosTerminalService');

const JWT_SECRET = process.env.JWT_SECRET_KEY;
const TOKEN_TTL_DAYS = parseInt(process.env.JWT_TTL_DAYS || '7', 10);
const PIN_PEPPER = process.env.PIN_PEPPER || process.env.JWT_SECRET_KEY || 'pin-pepper';
const PIN_LOGIN_MAX_ATTEMPTS = parseInt(process.env.PIN_LOGIN_MAX_ATTEMPTS || '5', 10);
const PIN_LOGIN_LOCK_MINUTES = parseInt(process.env.PIN_LOGIN_LOCK_MINUTES || '15', 10);

const sanitizeUser = (userDoc) => {
  if (!userDoc) return null;
  const obj = typeof userDoc.toObject === 'function' ? userDoc.toObject() : { ...userDoc };
  delete obj.passwordHash;
  delete obj.pinHash;
  delete obj.pinKey;
  delete obj.resetToken;
  delete obj.resetTokenExpiresAt;
  return obj;
};

const buildPinKey = (pin) => crypto.createHmac('sha256', PIN_PEPPER).update(String(pin)).digest('hex');
const comparePin = (pin, hash) => bcrypt.compare(String(pin) + PIN_PEPPER, hash);

class TenantAuthService {
  static signToken(payload){ return jwt.sign(payload, JWT_SECRET, { expiresIn: `${TOKEN_TTL_DAYS}d` }); }

  /** Admin-provisioned owner (Option A) */
  static async registerOwner(conn, { fullName, email, password, roles, branchIds }) {
    const existing = await TenantUserRepo.getByEmail(conn, email);
    if (existing) throw new AppError('Email already in use', 409);

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await TenantUserRepo.create(conn, {
      fullName, email, passwordHash,
      roles: roles?.length ? roles : ['owner'],
      branchIds: branchIds || [],
      status: 'active'
    });

    const token = this.signToken({ tenant: true, email, uid: user._id.toString(), roles: user.roles });
    return { status: 200, message: 'Tenant owner registered', result: { token, user } };
  }

  /** Login */
  static async login(conn, { email, password, branchId, posId, defaultBranchId }) {
    const userDoc = await TenantUserRepo.getDocByEmail(conn, email);
    if (!userDoc) throw new AppError('Invalid credentials', 401);
    if (userDoc.status !== 'active') throw new AppError('Account is not active', 403);

    const ok = await bcrypt.compare(password, userDoc.passwordHash);
    if (!ok) throw new AppError('Invalid credentials', 401);

    const branchIds = (userDoc.branchIds || []).map(String);
    const isTenantScoped = hasTenantScope(userDoc);
    const normalizedBranchId = branchId || null;

    if (!isTenantScoped) {
      if (!normalizedBranchId) throw new AppError('branchId is required for branch-scoped users', 400);
      if (!branchIds.includes(String(normalizedBranchId))) {
        throw new AppError('User is not assigned to this branch', 403);
      }
      if (!posId) throw new AppError('posId is required for branch-scoped users', 400);
    }

    let terminal = null;
    if (posId) {
      if (!normalizedBranchId) throw new AppError('branchId is required when specifying posId', 400);
      terminal = await PosTerminalService.getActiveInBranch(conn, normalizedBranchId, posId);
    }

    userDoc.lastLoginAt = new Date();
    await userDoc.save();

    const token = this.signToken({
      tenant: true,
      uid: userDoc._id.toString(),
      email: userDoc.email,
      roles: userDoc.roles,
      branchIds: userDoc.branchIds,
      branchId: normalizedBranchId || null,
      posId: posId || null,
      posName: terminal?.name || null,
      defaultBranchId: defaultBranchId || normalizedBranchId || null
    });

    return { status: 200, message: 'Login successful', result: { token,
      user: { _id: userDoc._id, fullName: userDoc.fullName, email: userDoc.email, roles: userDoc.roles, branchIds: userDoc.branchIds } } };
  }

  static async loginWithPin(conn, { pin, branchId, posId, defaultBranchId }) {
    const normalizedBranchId = branchId || null;
    const pinKey = buildPinKey(pin);
    const User = TenantUserRepo.model(conn);
    const userDoc = await User.findOne({ pinKey });
    if (!userDoc || !userDoc.pinHash) throw new AppError('Invalid credentials', 401);
    if (userDoc.status !== 'active') throw new AppError('Account is not active', 403);
    if (!userDoc.isStaff) throw new AppError('PIN login is only available for staff accounts', 403);

    const now = new Date();
    if (userDoc.pinLockedUntil && userDoc.pinLockedUntil > now) {
      const minutes = Math.ceil((userDoc.pinLockedUntil.getTime() - now.getTime()) / 60000);
      throw new AppError(`PIN is locked. Try again in ${minutes} minute(s)`, 423);
    }

    const ok = await comparePin(pin, userDoc.pinHash);
    if (!ok) {
      userDoc.pinLoginFailures = (userDoc.pinLoginFailures || 0) + 1;
      if (userDoc.pinLoginFailures >= PIN_LOGIN_MAX_ATTEMPTS) {
        userDoc.pinLockedUntil = new Date(Date.now() + PIN_LOGIN_LOCK_MINUTES * 60000);
        userDoc.pinLoginFailures = 0;
      }
      await userDoc.save();
      throw new AppError('Invalid credentials', 401);
    }

    const branchIds = (userDoc.branchIds || []).map(String);
    let effectiveBranch = normalizedBranchId;
    if (effectiveBranch) branchGuard(userDoc, effectiveBranch);
    if (!effectiveBranch) {
      if (!hasTenantScope(userDoc)) {
        if (branchIds.length === 1) {
          effectiveBranch = branchIds[0];
        } else {
          throw new AppError('branchId is required for branch-scoped staff', 400);
        }
      }
    }

    if (!effectiveBranch) throw new AppError('branchId is required for branch-scoped staff', 400);

    const terminal = await PosTerminalService.getActiveInBranch(conn, effectiveBranch, posId);

    userDoc.pinLoginFailures = 0;
    userDoc.pinLockedUntil = null;
    userDoc.lastPinLoginAt = now;
    userDoc.lastLoginAt = now;
    await userDoc.save();

    const token = this.signToken({
      tenant: true,
      uid: userDoc._id.toString(),
      email: userDoc.email,
      roles: userDoc.roles,
      branchIds: userDoc.branchIds,
      branchId: effectiveBranch || null,
      posId: posId || null,
      posName: terminal?.name || null,
      defaultBranchId: defaultBranchId || effectiveBranch || null,
      tillSessionId: null
    });

    return {
      status: 200,
      message: 'Login successful',
      result: {
        token,
        user: sanitizeUser(userDoc),
        branchId: effectiveBranch || null,
        tillSessionId: null
      }
    };
  }

  static async logoutWithPin(conn, userContext, { declaredClosingAmount, systemClosingAmount, cashCounts, notes, branchId, posId, tillSessionId }) {
    const uid = userContext?.uid;
    if (!uid) throw new AppError('Unauthorized', 401);

    const User = TenantUserRepo.model(conn);
    const userDoc = await User.findById(uid);
    if (!userDoc) throw new AppError('User not found', 404);
    if (userDoc.status !== 'active') throw new AppError('Account is not active', 403);

    const normalizedBranchId = branchId || userContext.branchId || null;
    const normalizedPosId = posId || userContext.posId || null;
    if (normalizedBranchId) branchGuard(userDoc, normalizedBranchId);
    const terminal = await PosTerminalService.getActiveInBranch(conn, normalizedBranchId, normalizedPosId);

    let sessionDoc = null;
    if (tillSessionId || userContext.tillSessionId) {
      sessionDoc = await TillSessionRepo.findOpenById(conn, tillSessionId || userContext.tillSessionId);
    }
    if (!sessionDoc) {
      sessionDoc = await TillSessionRepo.findOpenByBranchPos(
        conn,
        normalizedBranchId,
        normalizedPosId
      );
    }

    if (!sessionDoc) throw new AppError('No open till session found for this user/location', 404);

    branchGuard(userDoc, sessionDoc.branchId);
    const isTenantScoped = hasTenantScope(userDoc);
    if (!isTenantScoped && String(sessionDoc.staffId) !== String(userDoc._id)) {
      throw new AppError('Till session belongs to another staff member', 403);
    }
    if (normalizedPosId && sessionDoc.posId && String(sessionDoc.posId) !== String(normalizedPosId)) {
      throw new AppError('Till session is linked to a different POS terminal', 403);
    }

    const finalSystemAmount = (systemClosingAmount !== undefined && systemClosingAmount !== null)
      ? systemClosingAmount
      : (sessionDoc.systemClosingAmount ?? null);
    const variance = declaredClosingAmount - (finalSystemAmount ?? 0);

    sessionDoc.status = 'closed';
    sessionDoc.declaredClosingAmount = declaredClosingAmount;
    sessionDoc.systemClosingAmount = finalSystemAmount;
    sessionDoc.variance = variance;
    sessionDoc.closedAt = new Date();
    sessionDoc.cashCounts = cashCounts || sessionDoc.cashCounts;
    sessionDoc.notes = notes || sessionDoc.notes;
    sessionDoc.updatedBy = uid;
    await sessionDoc.save();

    logger.info('Till session closed', {
      tenant: conn?.name,
      branchId: sessionDoc.branchId,
      posId: sessionDoc.posId,
      staffId: sessionDoc.staffId,
      tillSessionId: sessionDoc._id.toString(),
      variance
    });

    const token = this.signToken({
      tenant: true,
      uid: userDoc._id.toString(),
      email: userDoc.email,
      roles: userDoc.roles,
      branchIds: userDoc.branchIds,
      branchId: normalizedBranchId || sessionDoc.branchId?.toString() || null,
      posId: normalizedPosId || sessionDoc.posId || null,
      posName: terminal?.name || null,
      defaultBranchId: userContext.defaultBranchId || normalizedBranchId || sessionDoc.branchId?.toString() || null,
      tillSessionId: null
    });

    return {
      status: 200,
      message: 'Till session closed',
      result: {
        token,
        tillSessionId: sessionDoc._id.toString(),
        variance,
        declaredClosingAmount,
        systemClosingAmount: finalSystemAmount
      }
    };
  }

  /** Invite-based: accept invite & set password (Option B) */
  static async acceptInvite(conn, { token, password, fullName }) {
    const User = TenantUserRepo.model(conn);
    const now = new Date();
    const userDoc = await User.findOne({ resetToken: token, resetTokenExpiresAt: { $gt: now } });
    if (!userDoc) throw new AppError('Invite token invalid or expired', 400);

    userDoc.passwordHash = await bcrypt.hash(password, 10);
    if (fullName) userDoc.fullName = fullName;
    userDoc.resetToken = null;
    userDoc.resetTokenExpiresAt = null;
    userDoc.mustChangePassword = false;
    userDoc.status = 'active';
    await userDoc.save();

    return { status: 200, message: 'Account activated' };
  }

  static async forgotPassword(conn, { email }) {
    const userDoc = await TenantUserRepo.getDocByEmail(conn, email);
    if (!userDoc) return { status: 200, message: 'If account exists, an email will be sent' };

    const token = crypto.randomBytes(24).toString('hex');
    userDoc.resetToken = token;
    userDoc.resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await userDoc.save();

    await sendEmail({
      from: '"Tritech Technology" <no-reply@tritechtechnologyllc.com>',
      to: email,
      subject: 'Reset your password',
      html: `<p>Use this token to reset your password: <b>${token}</b>. It expires in 1 hour.</p>`
    });

    return { status: 200, message: 'Password reset instructions sent (if account exists)' };
  }

  static async resetPassword(conn, { token, password }) {
    const User = TenantUserRepo.model(conn);
    const now = new Date();
    const userDoc = await User.findOne({ resetToken: token, resetTokenExpiresAt: { $gt: now } });
    if (!userDoc) throw new AppError('Reset token invalid or expired', 400);

    userDoc.passwordHash = await bcrypt.hash(password, 10);
    userDoc.resetToken = null;
    userDoc.resetTokenExpiresAt = null;
    await userDoc.save();

    return { status: 200, message: 'Password has been reset' };
  }

  static async me(conn, { uid }) {
    const user = await TenantUserRepo.getById(conn, uid);
    if (!user) throw new AppError('User not found', 404);
    return { status: 200, message: 'OK', result: user };
  }
}

module.exports = TenantAuthService;
