// features/pos/services/PosTerminalService.js
'use strict';

const AppError = require('../../../modules/AppError');
const logger = require('../../../modules/logger');
const BranchRepo = require('../../branch/repository/branch.repository');
const PosTerminalRepo = require('../repository/posTerminal.repository');
const { branchGuard, hasTenantScope } = require('../../tenant-auth/services/tenantGuards');

class PosTerminalService {
  static async create(conn, userContext, payload) {
    const { branchId, machineId, name, status = 'active', metadata } = payload;
    if (!branchId) throw new AppError('branchId is required', 400);

    const branchDoc = await BranchRepo.getById(conn, branchId);
    if (!branchDoc) throw new AppError('Branch not found', 404);

    if (!hasTenantScope(userContext)) {
      branchGuard(userContext, branchId);
    }

    const existingMachine = await PosTerminalRepo.findByMachineId(conn, machineId);
    if (existingMachine) throw new AppError('machineId already exists', 409);

    const terminal = await PosTerminalRepo.create(conn, {
      branchId,
      machineId,
      name,
      status,
      metadata: metadata || null,
      createdBy: userContext?.uid || null
    });

    logger.info('POS terminal created', {
      tenant: conn?.name,
      branchId,
      posId: terminal?._id?.toString(),
      machineId,
      actor: userContext?.uid || null
    });

    return { status: 201, message: 'POS terminal created', result: terminal };
  }

  static async list(conn, userContext, query = {}) {
    const { branchId, status, page, limit } = query;
    
    // Skip branch guard for public access (userContext is null for public endpoints)
    // When authenticated, enforce branch access control
    if (userContext && branchId && !hasTenantScope(userContext)) {
      branchGuard(userContext, branchId);
    }
    
    const result = await PosTerminalRepo.search(conn, { branchId, status, page, limit });
    return { status: 200, message: 'OK', result };
  }

  static async update(conn, userContext, id, payload) {
    const terminal = await PosTerminalRepo.findById(conn, id);
    if (!terminal) throw new AppError('POS terminal not found', 404);

    if (!hasTenantScope(userContext)) branchGuard(userContext, terminal.branchId);

    const { name, status, metadata, lastSeenAt } = payload;
    if (status && !['active', 'maintenance', 'retired'].includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    if (name !== undefined) terminal.name = name;
    if (status !== undefined) terminal.status = status;
    if (metadata !== undefined) terminal.metadata = metadata;
    if (lastSeenAt !== undefined) terminal.lastSeenAt = lastSeenAt;
    terminal.updatedBy = userContext?.uid || null;

    await terminal.save();

    logger.info('POS terminal updated', {
      tenant: conn?.name,
      posId: terminal._id.toString(),
      branchId: terminal.branchId,
      status: terminal.status,
      actor: userContext?.uid || null
    });

    return { status: 200, message: 'POS terminal updated', result: terminal };
  }

  static async getActiveInBranch(conn, branchId, posId) {
    if (!posId) throw new AppError('posId is required', 400);
    const terminal = await PosTerminalRepo.findById(conn, posId);
    if (!terminal) throw new AppError('POS terminal not found', 404);
    if (String(terminal.branchId) !== String(branchId)) {
      throw new AppError('POS terminal does not belong to branch', 400);
    }
    if (terminal.status !== 'active') throw new AppError('POS terminal is not active', 403);
    return terminal;
  }

  /**
   * Get available POS terminals for a cashier based on their restrictions
   * @param {Object} conn - Database connection
   * @param {String} branchId - Branch ID
   * @param {Array<String>} posIds - Array of allowed POS IDs (empty = all POS in branch)
   * @returns {Promise<Array>} List of available POS terminals
   */
  static async getAvailableForCashier(conn, branchId, posIds = []) {
    const filter = { branchId, status: 'active' };
    
    // If posIds is specified, filter to only those terminals
    if (posIds && posIds.length > 0) {
      filter._id = { $in: posIds };
    }
    
    const terminals = await PosTerminalRepo.model(conn)
      .find(filter)
      .select('_id name machineId status')
      .sort({ name: 1 })
      .lean();
    
    return terminals;
  }
}

module.exports = PosTerminalService;
