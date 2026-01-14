// features/staff/services/StaffService.js
'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const AppError = require('../../../modules/AppError');
const logger = require('../../../modules/logger');
const TenantUserRepo = require('../../tenant-auth/repository/tenantUser.repository');
const TenantUserDirectoryRepo = require('../../tenant-auth/repository/tenantUserDirectory.repository');
const TenantPinDirectoryRepo = require('../../tenant-auth/repository/tenantPinDirectory.repository');
const BranchRepo = require('../../branch/repository/branch.repository');

const PIN_PEPPER = process.env.PIN_PEPPER || process.env.JWT_SECRET_KEY || 'pin-pepper';
const PIN_BCRYPT_ROUNDS = parseInt(process.env.PIN_BCRYPT_ROUNDS || '12', 10);
const PASSWORD_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);

const buildPinSecrets = async (pin) => {
  if (!pin) return { pinHash: null, pinKey: null, pinUpdatedAt: null };
  const normalized = String(pin);
  const pinKey = crypto.createHmac('sha256', PIN_PEPPER).update(normalized).digest('hex');
  const pinHash = await bcrypt.hash(normalized + PIN_PEPPER, PIN_BCRYPT_ROUNDS);
  return { pinHash, pinKey, pinUpdatedAt: new Date() };
};

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

const unique = (arr = []) => Array.from(new Set(arr.map(String)));

async function ensureBranchesExist(conn, branchIds = [], { required = true } = {}) {
  const uniqueIds = unique(branchIds);
  if (!uniqueIds.length) {
    if (required) throw new AppError('At least one branch is required', 400);
    return [];
  }
  const branches = await BranchRepo.findManyByIds(conn, uniqueIds);
  if (branches.length !== uniqueIds.length) throw new AppError('One or more branches are invalid', 400);
  return uniqueIds;
}

async function ensureEmailAvailable(conn, email, excludeUserId = null) {
  const User = TenantUserRepo.model(conn);
  const query = excludeUserId ? { email, _id: { $ne: excludeUserId } } : { email };
  const existing = await User.findOne(query).lean();
  if (existing) throw new AppError('Email already in use', 409);
}

function guardBranchScope(actorDoc, branchContextId, targetBranchIds) {
  const isOwner = (actorDoc.roles || []).includes('owner');
  const hasTenantWideGrant = Array.isArray(actorDoc.roleGrants) && actorDoc.roleGrants.some((g) => g.scope === 'tenant');
  if (isOwner || hasTenantWideGrant || !branchContextId) return;

  const allowed = String(branchContextId);
  const invalid = targetBranchIds.some((b) => String(b) !== allowed);
  if (invalid) throw new AppError('Branch managers can only manage staff within their branch', 403);
}

function filterRoleGrants(grants = [], branchContextId, actorHasTenantScope) {
  if (!Array.isArray(grants) || !grants.length) return [];
  const allowedBranch = branchContextId ? String(branchContextId) : null;
  return grants.filter((g) => {
    if (g.scope === 'tenant') return actorHasTenantScope;
    if (g.scope === 'branch') return allowedBranch ? String(g.branchId) === allowedBranch : true;
    return false;
  }).map((g) => ({ roleKey: g.roleKey, scope: g.scope || 'tenant', branchId: g.branchId || null }));
}

function hasTenantScope(actorDoc) {
  return (actorDoc.roles || []).includes('owner') || (Array.isArray(actorDoc.roleGrants) && actorDoc.roleGrants.some((g) => g.scope === 'tenant'));
}

function ensureBranchContext(actorDoc, branchContextId) {
  if (!hasTenantScope(actorDoc) && !branchContextId) {
    throw new AppError('Branch context is required for branch-scoped managers', 403);
  }
}

async function getActor(conn, actorId) {
  const actor = await TenantUserRepo.getById(conn, actorId);
  if (!actor) throw new AppError('Actor not found', 404);
  return actor;
}

class StaffService {
  static async create(conn, actorId, payload, branchContextId = null, tenantSlug = null) {
    const { fullName, email, password, branchIds, assignedBranchId, posIds, roles, roleGrants = [], pin, position, metadata } = payload;

    const actorDoc = await getActor(conn, actorId);
    const actorTenantScope = hasTenantScope(actorDoc);
    ensureBranchContext(actorDoc, branchContextId);

    const normalizedBranches = await ensureBranchesExist(conn, branchIds, { required: false });

    guardBranchScope(actorDoc, branchContextId, normalizedBranches);

    // Validate assignedBranchId if provided
    let normalizedAssignedBranch = null;
    if (assignedBranchId) {
      const validatedBranches = await ensureBranchesExist(conn, [assignedBranchId], { required: true });
      normalizedAssignedBranch = validatedBranches[0];
      
      // Ensure assigned branch is within actor's scope
      if (branchContextId && String(normalizedAssignedBranch) !== String(branchContextId)) {
        throw new AppError('Cannot assign staff to a branch outside your scope', 403);
      }
    }

    // Validate posIds if provided
    let normalizedPosIds = [];
    if (posIds && posIds.length > 0) {
      if (!normalizedAssignedBranch) {
        throw new AppError('assignedBranchId is required when specifying POS terminals', 400);
      }
      // Validate that all POS terminals belong to the assigned branch
      const PosTerminalRepo = require('../../pos/repository/posTerminal.repository');
      for (const posId of posIds) {
        const terminal = await PosTerminalRepo.findById(conn, posId);
        if (!terminal) throw new AppError(`POS terminal ${posId} not found`, 404);
        if (String(terminal.branchId) !== String(normalizedAssignedBranch)) {
          throw new AppError(`POS terminal ${posId} does not belong to assigned branch`, 400);
        }
      }
      normalizedPosIds = posIds;
    }

    await ensureEmailAvailable(conn, email);

    const { pinHash, pinKey, pinUpdatedAt } = await buildPinSecrets(pin);
    
    // Generate unique Employee ID if PIN is being set
    let employeeId = null;
    if (pinKey && tenantSlug) {
      // Check PIN uniqueness within tenant (not globally)
      const existingPin = await TenantUserRepo.model(conn).findOne({ pinKey }).lean();
      if (existingPin) throw new AppError('PIN already in use by another staff member', 409);
      
      // Generate unique Employee ID
      employeeId = await TenantPinDirectoryRepo.generateUniqueEmployeeId();
    }

    const passwordHash = await bcrypt.hash(password || crypto.randomBytes(12).toString('hex'), PASSWORD_ROUNDS);
    const filteredGrants = filterRoleGrants(roleGrants, branchContextId, actorTenantScope);

    const doc = await TenantUserRepo.create(conn, {
      fullName,
      email,
      passwordHash,
      mustChangePassword: !password,
      roles: roles?.length ? roles : ['staff'],
      branchIds: normalizedBranches,
      assignedBranchId: normalizedAssignedBranch || null,
      posIds: normalizedPosIds,
      roleGrants: filteredGrants,
      isStaff: true,
      position: position || undefined,
      metadata: metadata || undefined,
      employeeId,
      pinHash,
      pinKey,
      pinUpdatedAt,
      invitedBy: actorId,
      status: 'active'
    });

    if (tenantSlug) {
      await TenantUserDirectoryRepo.upsertByEmail({
        email: doc.email,
        tenantSlug,
        tenantUserId: doc._id,
        userType: 'staff'
      });

      // Upsert PIN directory in main DB for Employee ID + PIN login
      if (pinKey && employeeId) {
        try {
          await TenantPinDirectoryRepo.upsert({
            employeeId,
            pinKey,
            tenantSlug,
            tenantUserId: doc._id,
            assignedBranchId: doc.assignedBranchId || null,
            posIds: doc.posIds || [],
            status: doc.status || 'active'
          });
          logger.info('[StaffService.create] Employee ID generated', { employeeId, email: doc.email });
        } catch (e) {
          logger.error('[StaffService.create] Failed to upsert PIN directory', e);
        }
      }
    }

    return { status: 200, message: 'Staff member created', result: sanitizeUser(doc) };
  }

  static async list(conn, actorId, query, branchContextId = null) {
    const { page = 1, limit = 20, status, branchId, q } = query;
    const effectiveBranchContext = branchContextId || branchId || null;
    const actorDoc = await getActor(conn, actorId);
    const actorTenantScope = hasTenantScope(actorDoc);

    const filter = { isStaff: true };
    if (status) filter.status = status;
    if (effectiveBranchContext) filter.branchIds = effectiveBranchContext;
    if (q) filter.$or = [
      { fullName: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } }
    ];

    if (!actorTenantScope) {
      if (effectiveBranchContext) {
        guardBranchScope(actorDoc, effectiveBranchContext, [effectiveBranchContext]);
      } else if (Array.isArray(actorDoc.branchIds) && actorDoc.branchIds.length) {
        filter.branchIds = { $in: actorDoc.branchIds.map(String) };
      } else {
        throw new AppError('Branch context is required for branch-scoped managers', 403);
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const User = TenantUserRepo.model(conn);
    const [items, count] = await Promise.all([
      User.find(filter)
        .select('-passwordHash -pinHash -pinKey -resetToken -resetTokenExpiresAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      User.countDocuments(filter)
    ]);

    return { status: 200, items, count, page: Number(page), limit: Number(limit) };
  }

  static async get(conn, actorId, id, branchContextId) {
    const actorDoc = await getActor(conn, actorId);
    const User = TenantUserRepo.model(conn);
    const userDoc = await User.findById(id).lean();
    if (!userDoc) throw new AppError('Staff not found', 404);
    if (!userDoc.isStaff) throw new AppError('Not a staff account', 400);

    if (branchContextId) guardBranchScope(actorDoc, branchContextId, userDoc.branchIds || []);

    return { status: 200, result: sanitizeUser(userDoc) };
  }

  static async update(conn, actorId, id, payload, branchContextId = null, tenantSlug = null) {
    const context = branchContextId || payload.branchId || null;
    const actorDoc = await getActor(conn, actorId);
    ensureBranchContext(actorDoc, context);
    const User = TenantUserRepo.model(conn);
    const userDoc = await User.findById(id);
    if (!userDoc) throw new AppError('Staff not found', 404);
    if (!userDoc.isStaff) throw new AppError('Not a staff account', 400);

    const nextBranches = payload.branchIds ? await ensureBranchesExist(conn, payload.branchIds) : (userDoc.branchIds || []);
    guardBranchScope(actorDoc, context, nextBranches);

    // Handle assignedBranchId update
    if (payload.assignedBranchId !== undefined) {
      if (payload.assignedBranchId) {
        const validatedBranches = await ensureBranchesExist(conn, [payload.assignedBranchId], { required: true });
        const normalizedAssignedBranch = validatedBranches[0];
        
        // Ensure assigned branch is within actor's scope
        if (context && String(normalizedAssignedBranch) !== String(context)) {
          throw new AppError('Cannot assign staff to a branch outside your scope', 403);
        }
        
        userDoc.assignedBranchId = normalizedAssignedBranch;
      } else {
        userDoc.assignedBranchId = null;
      }
    }

    // Handle posIds update
    if (payload.posIds !== undefined) {
      if (payload.posIds && payload.posIds.length > 0) {
        const effectiveAssignedBranch = userDoc.assignedBranchId || payload.assignedBranchId;
        if (!effectiveAssignedBranch) {
          throw new AppError('assignedBranchId is required when specifying POS terminals', 400);
        }
        
        // Validate that all POS terminals belong to the assigned branch
        const PosTerminalRepo = require('../../pos/repository/posTerminal.repository');
        for (const posId of payload.posIds) {
          const terminal = await PosTerminalRepo.findById(conn, posId);
          if (!terminal) throw new AppError(`POS terminal ${posId} not found`, 404);
          if (String(terminal.branchId) !== String(effectiveAssignedBranch)) {
            throw new AppError(`POS terminal ${posId} does not belong to assigned branch`, 400);
          }
        }
        userDoc.posIds = payload.posIds;
      } else {
        userDoc.posIds = [];
      }
    }

    const emailChanged = payload.email && payload.email !== userDoc.email;
    if (emailChanged) {
      await ensureEmailAvailable(conn, payload.email, id);
      userDoc.email = payload.email;
    }
    if (payload.fullName) userDoc.fullName = payload.fullName;
    if (payload.password) userDoc.passwordHash = await bcrypt.hash(payload.password, PASSWORD_ROUNDS);
    if (payload.roles) userDoc.roles = payload.roles;
    if (payload.position !== undefined) userDoc.position = payload.position;
    if (payload.metadata !== undefined) userDoc.metadata = payload.metadata;
    userDoc.branchIds = nextBranches;

    if (payload.roleGrants) {
      const actorTenantScope = hasTenantScope(actorDoc);
      userDoc.roleGrants = filterRoleGrants(payload.roleGrants, context, actorTenantScope);
    }

    const saved = await userDoc.save();

    if (tenantSlug && emailChanged) {
      await TenantUserDirectoryRepo.upsertByEmail({
        email: saved.email,
        tenantSlug,
        tenantUserId: saved._id,
        userType: 'staff'
      });
    }

    // Sync PIN directory on PIN change
    if (tenantSlug && payload.pin && userDoc.pinKey) {
      try {
        await TenantPinDirectoryRepo.upsert({
          pinKey: userDoc.pinKey,
          tenantSlug,
          tenantUserId: userDoc._id,
          assignedBranchId: userDoc.assignedBranchId || null,
          posIds: userDoc.posIds || [],
          status: userDoc.status || 'active'
        });
      } catch (e) {
        const logger = require('../../../modules/logger');
        logger.error('[StaffService.update] Failed to upsert PIN directory', e);
      }
    }

    return { status: 200, message: 'Staff updated', result: sanitizeUser(saved) };
  }

  static async setPin(conn, actorId, id, payload, branchContextId = null) {
    const context = branchContextId || payload.branchId || null;
    const actorDoc = await getActor(conn, actorId);
    ensureBranchContext(actorDoc, context);
    const User = TenantUserRepo.model(conn);
    const userDoc = await User.findById(id);
    if (!userDoc) throw new AppError('Staff not found', 404);
    if (!userDoc.isStaff) throw new AppError('Not a staff account', 400);

    guardBranchScope(actorDoc, context, userDoc.branchIds || []);

    const { pinHash, pinKey, pinUpdatedAt } = await buildPinSecrets(payload.pin);
    if (pinKey) {
      // Check PIN uniqueness within tenant (not globally)
      const existing = await User.findOne({ _id: { $ne: id }, pinKey }).lean();
      if (existing) throw new AppError('PIN already in use by another staff member', 409);
    }

    // Generate Employee ID if not already set
    let employeeId = userDoc.employeeId;
    if (pinKey && !employeeId && payload.tenantSlug) {
      employeeId = await TenantPinDirectoryRepo.generateUniqueEmployeeId();
      userDoc.employeeId = employeeId;
    }

    userDoc.pinHash = pinHash;
    userDoc.pinKey = pinKey;
    userDoc.pinUpdatedAt = pinUpdatedAt;
    userDoc.pinLoginFailures = 0;
    userDoc.pinLockedUntil = null;

    const saved = await userDoc.save();

    // Sync PIN directory with Employee ID
    if (payload.tenantSlug && userDoc.pinKey && userDoc.employeeId) {
      try {
        await TenantPinDirectoryRepo.upsert({
          employeeId: userDoc.employeeId,
          pinKey: userDoc.pinKey,
          tenantSlug: payload.tenantSlug,
          tenantUserId: userDoc._id,
          assignedBranchId: userDoc.assignedBranchId || null,
          posIds: userDoc.posIds || [],
          status: userDoc.status || 'active'
        });
        logger.info('[StaffService.setPin] PIN updated with Employee ID', { 
          employeeId: userDoc.employeeId, 
          email: userDoc.email 
        });
      } catch (e) {
        logger.error('[StaffService.setPin] Failed to upsert PIN directory', e);
      }
    }

    return { status: 200, message: 'PIN updated', result: sanitizeUser(saved) };
  }

  static async setStatus(conn, actorId, id, payload, branchContextId = null) {
    const context = branchContextId || payload.branchId || null;
    const actorDoc = await getActor(conn, actorId);
    ensureBranchContext(actorDoc, context);
    const User = TenantUserRepo.model(conn);
    const userDoc = await User.findById(id);
    if (!userDoc) throw new AppError('Staff not found', 404);
    if (!userDoc.isStaff) throw new AppError('Not a staff account', 400);

    guardBranchScope(actorDoc, context, userDoc.branchIds || []);

    userDoc.status = payload.status;
    const saved = await userDoc.save();
    return { status: 200, message: 'Status updated', result: sanitizeUser(saved) };
  }
}

module.exports = StaffService;
