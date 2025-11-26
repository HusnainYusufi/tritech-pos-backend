const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const AppError = require('../../../modules/AppError');
const logger = require('../../../modules/logger');
const TenantUserRepo = require('../repository/tenantUser.repository');
const { sendEmail } = require('../../../modules/helper');

const JWT_SECRET = process.env.JWT_SECRET_KEY;
const TOKEN_TTL_DAYS = parseInt(process.env.JWT_TTL_DAYS || '7', 10);

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
  static async login(conn, { email, password, posId, defaultBranchId }) {
    const userDoc = await TenantUserRepo.getDocByEmail(conn, email);
    if (!userDoc) throw new AppError('Invalid credentials', 401);
    if (userDoc.status !== 'active') throw new AppError('Account is not active', 403);

    const ok = await bcrypt.compare(password, userDoc.passwordHash);
    if (!ok) throw new AppError('Invalid credentials', 401);

    userDoc.lastLoginAt = new Date();
    await userDoc.save();

    const token = this.signToken({
      tenant: true,
      uid: userDoc._id.toString(),
      email: userDoc.email,
      roles: userDoc.roles,
      branchIds: userDoc.branchIds,
      posId: posId || null,
      defaultBranchId: defaultBranchId || null
    });

    return { status: 200, message: 'Login successful', result: { token,
      user: { _id: userDoc._id, fullName: userDoc.fullName, email: userDoc.email, roles: userDoc.roles, branchIds: userDoc.branchIds } } };
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
