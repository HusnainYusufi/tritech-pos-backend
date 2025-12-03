// features/pos/repository/posTerminal.repository.js
'use strict';

const { getTenantModel } = require('../../../modules/tenantModels');
const posTerminalSchemaFactory = require('../model/PosTerminal.schema');

function PosTerminal(conn) {
  return getTenantModel(conn, 'PosTerminal', posTerminalSchemaFactory, 'pos_terminals');
}

class PosTerminalRepository {
  static model(conn) { return PosTerminal(conn); }
  static create(conn, data) { return PosTerminal(conn).create(data); }
  static findById(conn, id) { return PosTerminal(conn).findById(id); }
  static findByMachineId(conn, machineId) { return PosTerminal(conn).findOne({ machineId }); }
  static async search(conn, { branchId, status, page = 1, limit = 20 }) {
    const filter = {};
    if (branchId) filter.branchId = branchId;
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [items, count] = await Promise.all([
      PosTerminal(conn).find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      PosTerminal(conn).countDocuments(filter)
    ]);

    return { items, count, page: Number(page), limit: Number(limit) };
  }
  static updateById(conn, id, data) { return PosTerminal(conn).findByIdAndUpdate(id, data, { new: true }); }
}

module.exports = PosTerminalRepository;
