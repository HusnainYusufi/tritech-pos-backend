const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const AppError = require('../../../modules/AppError');
const logger = require('../../../modules/logger');
const TenantUserRepo = require('../repository/tenantUser.repository');
const TillSessionRepo = require('../repository/tillSession.repository');
const TenantUserDirectoryRepo = require('../repository/tenantUserDirectory.repository');
const { sendEmail } = require('../../../modules/helper');
const { hasTenantScope, branchGuard, posGuard } = require('./tenantGuards');
const PosTerminalService = require('../../pos/services/PosTerminalService');
const { getTenantConnection } = require('../../../modules/connectionManager');
const Tenant = require('../../tenant/model/Tenant.model');
const OTPService = require('../../auth/services/OTPService');

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
  static signToken(payload) {
    // Ensure tenantSlug is always included for tenant users
    if (payload.tenant && !payload.tenantSlug) {
      throw new Error('tenantSlug is required in JWT payload for tenant users');
    }
    return jwt.sign(payload, JWT_SECRET, { expiresIn: `${TOKEN_TTL_DAYS}d` });
  }

  /** Admin-provisioned owner (Option A) */
  static async registerOwner(conn, { fullName, email, password, roles, branchIds }, tenantSlug) {
    const existing = await TenantUserRepo.getByEmail(conn, email);
    if (existing) throw new AppError('Email already in use', 409);

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await TenantUserRepo.create(conn, {
      fullName, email, passwordHash,
      roles: roles?.length ? roles : ['owner'],
      branchIds: branchIds || [],
      status: 'active'
    });

    // Main-DB directory entry: email -> tenantSlug (so gmail/outlook logins can resolve tenant)
    await TenantUserDirectoryRepo.upsertByEmail({
      email,
      tenantSlug,
      tenantUserId: user._id,
      userType: 'owner'
    });

    const token = this.signToken({ 
      tenant: true, 
      tenantSlug: tenantSlug,
      email, 
      uid: user._id.toString(), 
      roles: user.roles 
    });
    return { status: 200, message: 'Tenant owner registered', result: { token, user } };
  }

  /** Login */
  static async login(conn, { email, password, branchId, posId, defaultBranchId }, tenantSlug) {
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
      
      // Validate POS terminal access (Option 3: Hybrid approach)
      posGuard(userDoc, posId);
      
      terminal = await PosTerminalService.getActiveInBranch(conn, normalizedBranchId, posId);
    }

    userDoc.lastLoginAt = new Date();
    await userDoc.save();

    const token = this.signToken({
      tenant: true,
      tenantSlug: tenantSlug,
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

  /**
   * Public PIN login without requiring tenantSlug from client.
   * Steps:
   * 1) Compute pinKey from PIN
   * 2) Resolve tenant via main DB pin directory
   * 3) Connect to tenant DB and validate pinHash + status + branch/POS checks
   */
  static async loginWithPin(_conn, { pin, terminalId } /* tenantSlug ignored */) {
    const pinKey = buildPinKey(pin);

    // 1) Resolve tenant + user via main DB directory
    const pinDirectoryRepo = require('../repository/tenantPinDirectory.repository');
    const pinEntry = await pinDirectoryRepo.findByPinKey(pinKey);
    if (!pinEntry) throw new AppError('Invalid credentials', 401);
    if (pinEntry.status && pinEntry.status !== 'active') throw new AppError('Account is not active', 403);

    // 2) Get tenant connection
    const Tenant = require('../../tenant/model/Tenant.model');
    const tenantDoc = await Tenant.findOne({ slug: pinEntry.tenantSlug }).lean();
    if (!tenantDoc || !tenantDoc.dbUri) throw new AppError('Tenant not found', 404);

    const conn = await getTenantConnection(pinEntry.tenantSlug, tenantDoc.dbUri);
    const User = TenantUserRepo.model(conn);
    const userDoc = await User.findById(pinEntry.tenantUserId);
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

    // 🔒 SECURITY: Cashier must have an assigned branch
    if (!userDoc.assignedBranchId) {
      throw new AppError('Cashier is not assigned to any branch. Please contact your manager.', 403);
    }

    const effectiveBranch = String(userDoc.assignedBranchId);
    
    // Determine POS terminal assignment
    let effectivePosId = null;
    let terminal = null;
    const posIds = (userDoc.posIds || []).map(String);

    if (posIds.length === 1) {
      // Single POS assigned - auto-login to that POS
      effectivePosId = posIds[0];
      terminal = await PosTerminalService.getActiveInBranch(conn, effectiveBranch, effectivePosId);
    } else if (posIds.length > 1) {
      // Multiple POS assigned - cashier needs to select (frontend will handle this)
      // We'll return the list of available POS terminals
      effectivePosId = null;
      terminal = null;
    } else {
      // No POS restrictions - cashier can use any POS in their branch
      // Frontend will need to show POS selection
      effectivePosId = null;
      terminal = null;
    }

    userDoc.pinLoginFailures = 0;
    userDoc.pinLockedUntil = null;
    userDoc.lastPinLoginAt = now;
    userDoc.lastLoginAt = now;
    await userDoc.save();

    // Get available POS terminals for this cashier
    const availableTerminals = await PosTerminalService.getAvailableForCashier(
      conn, 
      effectiveBranch, 
      posIds
    );

    const token = this.signToken({
      tenant: true,
      tenantSlug: pinEntry.tenantSlug,
      uid: userDoc._id.toString(),
      email: userDoc.email,
      roles: userDoc.roles,
      branchIds: userDoc.branchIds,
      branchId: effectiveBranch,
      posId: effectivePosId,
      posName: terminal?.name || null,
      defaultBranchId: effectiveBranch,
      tillSessionId: null
    });

    // Get branch POS config for frontend
    const BranchConfigService = require('../../branch/services/BranchConfigService');
    const branchConfig = await BranchConfigService.getPosConfigForAuth(conn, effectiveBranch);

    return {
      status: 200,
      message: 'Login successful',
      result: {
        token,
        user: sanitizeUser(userDoc),
        branchId: effectiveBranch,
        posId: effectivePosId,
        posName: terminal?.name || null,
        requiresPosSelection: !effectivePosId, // true if cashier needs to select POS
        availableTerminals: availableTerminals || [], // List of POS terminals cashier can use
        tillSessionId: null,
        branchConfig // ✅ Frontend now knows paymentMode and receipt settings
      }
    };
  }

  static async logoutWithPin(conn, userContext, { declaredClosingAmount, systemClosingAmount, cashCounts, notes, branchId, posId, tillSessionId }, tenantSlug) {
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
      tenantSlug: tenantSlug,
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

  /**
   * Accept invite & set password (PUBLIC endpoint - no tenant context required)
   * Searches all tenants for the token
   */
  static async acceptInvite({ token, password, fullName }) {
    if (!token) throw new AppError('token required', 400);
    if (!password) throw new AppError('password required', 400);

    // 1. Get all active tenants from main DB
    const tenants = await Tenant.find({ status: { $ne: 'deleted' } }).select('slug dbUri').lean();
    if (!tenants.length) throw new AppError('No tenants found', 500);

    logger.info('[TenantAuthService.acceptInvite] Searching for token across tenants');

    // 2. Search for token across all tenant DBs
    let userDoc = null;
    let foundTenantSlug = null;

    for (const tenant of tenants) {
      if (!tenant.dbUri) continue;
      
      try {
        const conn = await getTenantConnection(tenant.slug, tenant.dbUri);
        const User = TenantUserRepo.model(conn);
        const now = new Date();
        
        const user = await User.findOne({ 
          resetToken: token, 
          resetTokenExpiresAt: { $gt: now }
        });
        
        if (user) {
          userDoc = user;
          foundTenantSlug = tenant.slug;
          break;
        }
      } catch (err) {
        logger.warn(`[TenantAuthService.acceptInvite] Error checking tenant ${tenant.slug}`, err);
        continue;
      }
    }

    if (!userDoc) throw new AppError('Token invalid or expired', 400);

    logger.info('[TenantAuthService.acceptInvite] Token found', { 
      email: userDoc.email, 
      tenantSlug: foundTenantSlug 
    });

    // 3. Update password and activate
    userDoc.passwordHash = await bcrypt.hash(password, 10);
    if (fullName) userDoc.fullName = fullName;
    userDoc.resetToken = null;
    userDoc.resetTokenExpiresAt = null;
    userDoc.mustChangePassword = false;
    userDoc.status = 'active';
    await userDoc.save();

    // 4. Update main DB directory for future logins
    await TenantUserDirectoryRepo.upsertByEmail({
      email: userDoc.email,
      tenantSlug: foundTenantSlug,
      tenantUserId: userDoc._id,
      userType: 'staff'
    });

    logger.info('[TenantAuthService.acceptInvite] Password set successfully', { 
      email: userDoc.email, 
      tenantSlug: foundTenantSlug,
      userId: userDoc._id 
    });

    return { 
      status: 200, 
      message: 'Password set successfully. You can now login.',
      result: {
        email: userDoc.email,
        tenantSlug: foundTenantSlug
      }
    };
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

    // Include branch POS config for cashiers/staff
    let branchConfig = null;
    if (user.assignedBranchId || user.branchIds?.length > 0) {
      const BranchConfigService = require('../../branch/services/BranchConfigService');
      const branchId = user.assignedBranchId || user.branchIds[0];
      branchConfig = await BranchConfigService.getPosConfigForAuth(conn, branchId);
    }

    return { 
      status: 200, 
      message: 'OK', 
      result: {
        ...user,
        branchConfig
      }
    };
  }

  // ==================== OTP-BASED PASSWORD RESET ====================

  /**
   * Request OTP for tenant password reset
   * Tenant is resolved from Main DB TenantUserDirectory
   */
  static async requestPasswordResetOTP({ email }, metadata = {}) {
    const normalizedEmail = email.toLowerCase().trim();

    // Look up tenant from Main DB directory
    const directoryEntry = await TenantUserDirectoryRepo.findByEmail(normalizedEmail);
    
    if (!directoryEntry) {
      // Don't reveal if user exists or not (security best practice)
      return {
        status: 200,
        message: 'If an account exists with this email, an OTP has been sent.'
      };
    }

    const tenantSlug = directoryEntry.tenantSlug;

    // Verify tenant exists
    const tenant = await Tenant.findOne({ slug: tenantSlug });
    if (!tenant) {
      // Don't reveal if tenant exists or not
      return {
        status: 200,
        message: 'If an account exists with this email, an OTP has been sent.'
      };
    }

    // Connect to tenant DB
    const conn = await getTenantConnection(tenant.dbURI);

    // Check if user exists
    const userDoc = await TenantUserRepo.getByEmail(conn, normalizedEmail);
    if (!userDoc) {
      // Don't reveal if user exists or not
      return {
        status: 200,
        message: 'If an account exists with this email, an OTP has been sent.'
      };
    }

    // Request OTP
    return await OTPService.requestOTP(normalizedEmail, 'tenant', tenantSlug, metadata);
  }

  /**
   * Verify OTP for tenant password reset
   * Tenant is resolved from Main DB TenantUserDirectory
   */
  static async verifyPasswordResetOTP({ email, otp }) {
    const normalizedEmail = email.toLowerCase().trim();

    // Look up tenant from Main DB directory
    const directoryEntry = await TenantUserDirectoryRepo.findByEmail(normalizedEmail);
    
    if (!directoryEntry) {
      throw new AppError('User not found', 404);
    }

    const tenantSlug = directoryEntry.tenantSlug;

    // Verify tenant exists
    const tenant = await Tenant.findOne({ slug: tenantSlug });
    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    // Connect to tenant DB
    const conn = await getTenantConnection(tenant.dbURI);

    // Check if user exists
    const userDoc = await TenantUserRepo.getByEmail(conn, normalizedEmail);
    if (!userDoc) {
      throw new AppError('User not found', 404);
    }

    // Verify OTP
    return await OTPService.verifyOTP(normalizedEmail, otp);
  }

  /**
   * Reset password with verified OTP
   */
  static async resetPasswordWithOTP({ email, password }) {
    const normalizedEmail = email.toLowerCase().trim();

    // Validate that OTP was verified
    const otpRecord = await OTPService.validateVerifiedOTP(normalizedEmail);

    if (otpRecord.userType !== 'tenant') {
      throw new AppError('Invalid OTP for tenant user', 400);
    }

    // Verify tenant exists
    const tenant = await Tenant.findOne({ slug: otpRecord.tenantSlug });
    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    // Connect to tenant DB
    const conn = await getTenantConnection(tenant.dbURI);

    // Find user
    const userDoc = await TenantUserRepo.getDocByEmail(conn, normalizedEmail);
    if (!userDoc) {
      throw new AppError('User not found', 404);
    }

    // Update password
    userDoc.passwordHash = await bcrypt.hash(password, 10);
    userDoc.resetToken = null;
    userDoc.resetTokenExpiresAt = null;
    await userDoc.save();

    // Mark OTP as used
    await OTPService.markOTPAsUsed(normalizedEmail);

    logger.info(`Tenant password reset successful for: ${normalizedEmail} (tenant: ${otpRecord.tenantSlug})`);

    return {
      status: 200,
      message: 'Password reset successful. You can now login with your new password.',
      result: {
        email: normalizedEmail,
        tenantSlug: otpRecord.tenantSlug
      }
    };
  }
}

module.exports = TenantAuthService;
