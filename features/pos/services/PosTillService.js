// features/pos/services/PosTillService.js
'use strict';

const AppError = require('../../../modules/AppError');
const logger = require('../../../modules/logger');
const TenantAuthService = require('../../tenant-auth/services/TenantAuthService');
const TenantUserRepo = require('../../tenant-auth/repository/tenantUser.repository');
const TillSessionRepo = require('../../tenant-auth/repository/tillSession.repository');
const PosTerminalService = require('./PosTerminalService');
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

    const terminal = await PosTerminalService.getActiveInBranch(conn, effectiveBranch, posId);

    const existingSession = await TillSessionRepo.findOpenByBranchPos(
      conn,
      effectiveBranch,
      posId
    );
    if (existingSession) {
      const sameStaff = String(existingSession.staffId) === String(userDoc._id);
      const errorMsg = sameStaff
        ? 'You already have an open till session on this POS terminal'
        : 'Another cashier has an open till session on this POS terminal';
      throw new AppError(errorMsg, 409);
    }

    const now = new Date();
    const tillSession = await TillSessionRepo.create(conn, {
      staffId: userDoc._id,
      branchId: effectiveBranch,
      posId,
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
      posName: terminal?.name || null,
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

    const token = TenantAuthService.signToken({
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

  /**
   * Get cashier session data from token
   * Returns complete cashier info, till session, and calculated balances
   */
  static async getCashierSession(conn, userContext) {
    const uid = userContext?.uid;
    if (!uid) throw new AppError('Unauthorized', 401);

    const PosOrderRepo = require('../repository/posOrder.repository');
    const BranchRepo = require('../../branch/repository/branch.repository');

    // Get user details
    const User = TenantUserRepo.model(conn);
    const userDoc = await User.findById(uid)
      .select('-passwordHash -pinHash -pinKey -resetToken')
      .lean();
    
    if (!userDoc) throw new AppError('User not found', 404);
    if (userDoc.status !== 'active') throw new AppError('Account is not active', 403);

    // Get till session if exists
    let tillSession = null;
    let terminal = null;
    let branch = null;
    let sessionStats = null;

    if (userContext.tillSessionId) {
      tillSession = await TillSessionRepo.findOpenById(conn, userContext.tillSessionId);
      
      if (tillSession) {
        // Get terminal details
        if (tillSession.posId) {
          terminal = await PosTerminalService.getActiveInBranch(
            conn, 
            tillSession.branchId, 
            tillSession.posId
          );
        }

        // Get branch details
        if (tillSession.branchId) {
          branch = await BranchRepo.model(conn)
            .findById(tillSession.branchId)
            .select('name code address')
            .lean();
        }

        // Calculate session statistics
        const PosOrder = PosOrderRepo.model(conn);
        const sessionOrders = await PosOrder.find({
          tillSessionId: tillSession._id,
          status: { $in: ['placed', 'paid'] }
        }).lean();

        const totalSales = sessionOrders.reduce((sum, order) => sum + (order.totals?.grandTotal || 0), 0);
        const totalCash = sessionOrders
          .filter(o => o.payment?.method === 'cash')
          .reduce((sum, order) => sum + (order.payment?.amountPaid || 0), 0);
        const totalCard = sessionOrders
          .filter(o => o.payment?.method === 'card')
          .reduce((sum, order) => sum + (order.payment?.amountPaid || 0), 0);
        const totalMobile = sessionOrders
          .filter(o => o.payment?.method === 'mobile')
          .reduce((sum, order) => sum + (order.payment?.amountPaid || 0), 0);

        const currentBalance = tillSession.openingAmount + totalCash;
        const expectedBalance = tillSession.openingAmount + totalCash;

        sessionStats = {
          totalOrders: sessionOrders.length,
          totalSales: parseFloat(totalSales.toFixed(2)),
          totalCash: parseFloat(totalCash.toFixed(2)),
          totalCard: parseFloat(totalCard.toFixed(2)),
          totalMobile: parseFloat(totalMobile.toFixed(2)),
          currentBalance: parseFloat(currentBalance.toFixed(2)),
          expectedBalance: parseFloat(expectedBalance.toFixed(2)),
          openingAmount: tillSession.openingAmount,
          sessionDuration: Math.floor((Date.now() - new Date(tillSession.openedAt).getTime()) / 1000 / 60) // minutes
        };
      }
    }

    return {
      status: 200,
      message: 'OK',
      result: {
        user: {
          _id: userDoc._id,
          fullName: userDoc.fullName,
          email: userDoc.email,
          roles: userDoc.roles,
          isStaff: userDoc.isStaff,
          position: userDoc.position,
          branchIds: userDoc.branchIds,
          status: userDoc.status
        },
        session: {
          branchId: userContext.branchId,
          posId: userContext.posId,
          posName: userContext.posName,
          tillSessionId: userContext.tillSessionId || null,
          hasTillSession: !!tillSession
        },
        tillSession: tillSession ? {
          _id: tillSession._id,
          status: tillSession.status,
          openingAmount: tillSession.openingAmount,
          openedAt: tillSession.openedAt,
          cashCounts: tillSession.cashCounts,
          notes: tillSession.notes
        } : null,
        terminal: terminal ? {
          _id: terminal._id,
          name: terminal.name,
          code: terminal.code,
          status: terminal.status
        } : null,
        branch: branch || null,
        stats: sessionStats
      }
    };
  }
}

module.exports = PosTillService;
