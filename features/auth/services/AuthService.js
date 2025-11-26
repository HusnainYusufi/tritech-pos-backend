const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const AppError = require('../../../modules/AppError');
const logger = require('../../../modules/logger');
const UserRepo = require('../repository/user.repository');
const RoleRepo = require('../../role/repository/role.repository'); // uses your existing Role repo

const JWT_SECRET = process.env.JWT_SECRET_KEY;
const TOKEN_TTL_DAYS = parseInt(process.env.JWT_TTL_DAYS || '7', 10);
const SUPERADMIN_INVITE_CODE = process.env.SUPERADMIN_INVITE_CODE || '';

class AuthService {
  static signToken(user){
    const payload = {
      _id: user._id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.roleName,
      roles: user.roles && user.roles.length ? user.roles : [user.roleName]
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: `${TOKEN_TTL_DAYS}d` });
    return token;
  }

  /** Registration (admin signup)
   * First user can register without invite code (bootstrap).
   * After that, if you want to restrict, require SUPERADMIN_INVITE_CODE or do admin-created users.
   * NOTE: Must pass roleId of the 'superadmin' Role to gain admin access.
   */
  static async register({ fullName, email, password, roleId, inviteCode }){
    const existing = await UserRepo.getByEmail(email);
    if (existing) throw new AppError('Email already in use', 409);

    // Resolve role
    const roleDoc = await RoleRepo.getById(roleId);
    if (!roleDoc) throw new AppError('Role not found', 404);

    // Optional: gate registration after first account exists
    const totalUsers = await UserRepo.countAdmins();
    if (totalUsers > 0 && SUPERADMIN_INVITE_CODE && inviteCode !== SUPERADMIN_INVITE_CODE) {
      throw new AppError('Invalid invite code', 403);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await UserRepo.create({
      fullName, email,
      roleId: roleDoc._id,
      roleName: roleDoc.name,
      roles: [roleDoc.name],
      passwordHash
    });

    const token = this.signToken(user);

    return {
      status: 200,
      message: 'Admin registered',
      result: { token, user: { _id: user._id, fullName, email, roleId: user.roleId, roleName: user.roleName } }
    };
  }

  static async login({ email, password }){
    const userDoc = await UserRepo.getDocByEmail(email);
    if (!userDoc) throw new AppError('Invalid credentials', 401);
    if (userDoc.status !== 'active') throw new AppError('Account is not active', 403);

    const ok = await bcrypt.compare(password, userDoc.passwordHash);
    if (!ok) throw new AppError('Invalid credentials', 401);

    userDoc.lastLoginAt = new Date();
    await userDoc.save();

    const token = this.signToken(userDoc);
    return {
      status: 200,
      message: 'Login successful',
      result: {
        token,
        user: {
          _id: userDoc._id,
          fullName: userDoc.fullName,
          email: userDoc.email,
          roleId: userDoc.roleId,
          roleName: userDoc.roleName
        }
      }
    };
  }

  static async verifyToken(token){
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return { status: 200, message: 'OK', result: decoded };
    } catch (e) {
      throw new AppError('Invalid token', 401);
    }
  }

  static async forgotPassword({ email }){
    const userDoc = await UserRepo.getDocByEmail(email);
    if (!userDoc) return { status: 200, message: 'If account exists, an email will be sent' };

    const token = crypto.randomBytes(24).toString('hex');
    userDoc.resetToken = token;
    userDoc.resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); 
    await userDoc.save();

   
    logger.info('Password reset token', { email, token });

    return { status: 200, message: 'Password reset instructions sent (if account exists)' };
  }

  static async resetPassword({ token, password }){
    const now = new Date();
    const User = require('../model/User.model');
    const userDoc = await User.findOne({ resetToken: token, resetTokenExpiresAt: { $gt: now } });
    if (!userDoc) throw new AppError('Reset token invalid or expired', 400);

    userDoc.passwordHash = await bcrypt.hash(password, 10);
    userDoc.resetToken = null;
    userDoc.resetTokenExpiresAt = null;
    await userDoc.save();

    return { status: 200, message: 'Password has been reset' };
  }
}

module.exports = AuthService;
