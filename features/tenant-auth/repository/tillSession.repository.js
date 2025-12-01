const { getTenantModel } = require('../../../modules/tenantModels');
const tillSessionSchemaFactory = require('../model/TillSession.schema');

function TillSession(conn) {
  return getTenantModel(conn, 'TillSession', tillSessionSchemaFactory, 'till_sessions');
}

class TillSessionRepository {
  static create(conn, data) { return TillSession(conn).create(data); }
  static findOpenByStaffBranchPos(conn, staffId, branchId, posId) {
    const query = { staffId, status: 'open' };
    if (branchId !== undefined) query.branchId = branchId;
    if (posId !== undefined) query.posId = posId || null;
    return TillSession(conn).findOne(query);
  }
  static findOpenById(conn, id) { return TillSession(conn).findOne({ _id: id, status: 'open' }); }
  static model(conn) { return TillSession(conn); }
}

module.exports = TillSessionRepository;
