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
   * Calculate order statistics using efficient aggregation
   * @private
   */
  static async _calculateOrderStats(conn, filter, tillSession = null) {
    const PosOrderRepo = require('../repository/posOrder.repository');
    const PosOrder = PosOrderRepo.model(conn);

    // Use aggregation for efficient calculation
    const stats = await PosOrder.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSales: { $sum: '$totals.grandTotal' },
          totalCash: {
            $sum: {
              $cond: [{ $eq: ['$payment.method', 'cash'] }, '$payment.amountPaid', 0]
            }
          },
          totalCard: {
            $sum: {
              $cond: [{ $eq: ['$payment.method', 'card'] }, '$payment.amountPaid', 0]
            }
          },
          totalMobile: {
            $sum: {
              $cond: [{ $eq: ['$payment.method', 'mobile'] }, '$payment.amountPaid', 0]
            }
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalOrders: 0,
      totalSales: 0,
      totalCash: 0,
      totalCard: 0,
      totalMobile: 0
    };

    // Calculate balances
    const openingAmount = tillSession?.openingAmount || 0;
    const currentBalance = openingAmount + result.totalCash;
    const sessionDuration = tillSession 
      ? Math.floor((Date.now() - new Date(tillSession.openedAt).getTime()) / 1000 / 60)
      : null;

    return {
      totalOrders: result.totalOrders,
      totalSales: Number.parseFloat((result.totalSales || 0).toFixed(2)),
      totalCash: Number.parseFloat((result.totalCash || 0).toFixed(2)),
      totalCard: Number.parseFloat((result.totalCard || 0).toFixed(2)),
      totalMobile: Number.parseFloat((result.totalMobile || 0).toFixed(2)),
      currentBalance: Number.parseFloat(currentBalance.toFixed(2)),
      expectedBalance: Number.parseFloat(currentBalance.toFixed(2)),
      openingAmount: openingAmount,
      sessionDuration: sessionDuration,
      scope: tillSession ? 'session' : 'today'
    };
  }

  /**
   * Get cashier session data from token
   * Returns complete cashier info, till session, and calculated balances
   * 
   * Stats are ALWAYS provided:
   * - If till session is open: stats for that session
   * - If no till session: stats for today's orders by this cashier
   */
  static async getCashierSession(conn, userContext) {
    const uid = userContext?.uid;
    if (!uid) throw new AppError('Unauthorized', 401);

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

    if (userContext.tillSessionId) {
      tillSession = await TillSessionRepo.findOpenById(conn, userContext.tillSessionId);
    }

    // Get terminal details (from token or till session)
    const effectivePosId = userContext.posId || tillSession?.posId;
    const effectiveBranchId = userContext.branchId || tillSession?.branchId;

    if (effectivePosId && effectiveBranchId) {
      try {
        terminal = await PosTerminalService.getActiveInBranch(
          conn, 
          effectiveBranchId, 
          effectivePosId
        );
      } catch (err) {
        // Terminal not found or inactive - log and continue without terminal data
        logger.warn('Terminal not found or inactive', { 
          posId: effectivePosId, 
          branchId: effectiveBranchId,
          error: err.message 
        });
        terminal = null;
      }
    }

    // Get branch details
    if (effectiveBranchId) {
      branch = await BranchRepo.model(conn)
        .findById(effectiveBranchId)
        .select('name code address')
        .lean();
    }

    // Calculate statistics
    // Strategy: If till session exists, show session stats. Otherwise, show today's stats for this cashier.
    let statsFilter;
    if (tillSession) {
      // Till session open: show session-specific stats
      statsFilter = {
        tillSessionId: tillSession._id,
        status: { $in: ['placed', 'paid'] }
      };
    } else {
      // No till session: show today's orders for this cashier
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      statsFilter = {
        staffId: uid,
        status: { $in: ['placed', 'paid'] },
        createdAt: { $gte: todayStart }
      };

      // If cashier is branch-scoped, filter by their branch
      if (effectiveBranchId) {
        statsFilter.branchId = effectiveBranchId;
      }
    }

    const sessionStats = await this._calculateOrderStats(conn, statsFilter, tillSession);

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
          branchId: effectiveBranchId || null,
          posId: effectivePosId || null,
          posName: userContext.posName || null,
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
