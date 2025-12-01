// features/pos/services/PosTillService.js
'use strict';

const AppError = require('../../../modules/AppError');
const logger = require('../../../modules/logger');
const TenantAuthService = require('../../tenant-auth/services/TenantAuthService');
const TenantUserRepo = require('../../tenant-auth/repository/tenantUser.repository');
const TillSessionRepo = require('../../tenant-auth/repository/tillSession.repository');
const { hasTenantScope, branchGuard } = require('../../tenant-auth/services/tenantGuards');

class PosTillService {
  static async openTill(conn, userContext, { branchId, posId, openingAmount, cashCounts, notes }) {
    const uid = userContext?.uid;
    if (!uid) throw new AppError('Unauthorized', 401);

    const User = TenantUserRepo.model(conn);
    const userDoc = await User.findById(uid);
    if (!userDoc) throw new AppError('User not found', 404);
    if (userDoc.status !== 'active') throw new AppError('Account is not active', 403);
    if (!userDoc.isStaff) throw new AppError('Only staff accounts can open a till session', 403);

    const branchIds = (userDoc.branchIds || []).map(String);
    let effectiveBranch = branchId || userContext.branchId || null;
    if (effectiveBranch) branchGuard(userDoc, effectiveBranch);
    if (!effectiveBranch && !hasTenantScope(userDoc)) {
      if (branchIds.length === 1) {
        effectiveBranch = branchIds[0];
      } else {
        throw new AppError('branchId is required for branch-scoped staff', 400);
      }
    }
    if (!effectiveBranch) throw new AppError('branchId is required to open a till session', 400);

    const existingSession = await TillSessionRepo.findOpenByStaffBranchPos(
      conn,
      userDoc._id,
      effectiveBranch,
      posId || null
    );
    if (existingSession) {
      throw new AppError('An open till session already exists for this branch/POS', 409);
    }

    const now = new Date();
    const tillSession = await TillSessionRepo.create(conn, {
      staffId: userDoc._id,
      branchId: effectiveBranch,
      posId: posId || null,
      openingAmount,
      openedAt: now,
      cashCounts: cashCounts || null,
      notes: notes || null,
      createdBy: uid
    });

    logger.info('Till session opened', {
      tenant: conn?.name,
      branchId: effectiveBranch,
      posId: posId || null,
      staffId: userDoc._id.toString(),
      tillSessionId: tillSession._id.toString()
    });

    const token = TenantAuthService.signToken({
      tenant: true,
      uid: userDoc._id.toString(),
      email: userDoc.email,
      roles: userDoc.roles,
      branchIds: userDoc.branchIds,
      branchId: effectiveBranch || null,
      posId: posId || null,
      defaultBranchId: userContext.defaultBranchId || effectiveBranch || null,
      tillSessionId: tillSession._id.toString()
    });

    return {
      status: 201,
      message: 'Till session opened',
      result: {
        token,
        tillSessionId: tillSession._id.toString(),
        branchId: effectiveBranch || null,
        openedAt: tillSession.openedAt
      }
    };
  }

  static async closeTill(conn, userContext, { declaredClosingAmount, systemClosingAmount, cashCounts, notes, branchId, posId, tillSessionId }) {
    const uid = userContext?.uid;
    if (!uid) throw new AppError('Unauthorized', 401);

    const User = TenantUserRepo.model(conn);
    const userDoc = await User.findById(uid);
    if (!userDoc) throw new AppError('User not found', 404);
    if (userDoc.status !== 'active') throw new AppError('Account is not active', 403);

    const normalizedBranchId = branchId || userContext.branchId || null;
    const normalizedPosId = posId || userContext.posId || null;
    if (normalizedBranchId) branchGuard(userDoc, normalizedBranchId);

    let sessionDoc = null;
    if (tillSessionId || userContext.tillSessionId) {
      sessionDoc = await TillSessionRepo.findOpenById(conn, tillSessionId || userContext.tillSessionId);
    }
    if (!sessionDoc) {
      sessionDoc = await TillSessionRepo.findOpenByStaffBranchPos(
        conn,
        userDoc._id,
        normalizedBranchId || undefined,
        normalizedPosId || null
      );
    }

    if (!sessionDoc) throw new AppError('No open till session found for this user/location', 404);

    branchGuard(userDoc, sessionDoc.branchId);
    const isTenantScoped = hasTenantScope(userDoc);
    if (!isTenantScoped && String(sessionDoc.staffId) !== String(userDoc._id)) {
      throw new AppError('Till session belongs to another staff member', 403);
    }
    if (normalizedPosId && sessionDoc.posId && sessionDoc.posId !== normalizedPosId) {
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

    const token = TenantAuthService.signToken({
      tenant: true,
      uid: userDoc._id.toString(),
      email: userDoc.email,
      roles: userDoc.roles,
      branchIds: userDoc.branchIds,
      branchId: normalizedBranchId || sessionDoc.branchId?.toString() || null,
      posId: normalizedPosId || sessionDoc.posId || null,
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
}

module.exports = PosTillService;
