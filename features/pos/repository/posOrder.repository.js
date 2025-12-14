// features/pos/repository/posOrder.repository.js
'use strict';

const { getTenantModel } = require('../../../modules/tenantModels');
const posOrderSchemaFactory = require('../model/PosOrder.schema');

function PosOrder(conn) {
  return getTenantModel(conn, 'PosOrder', posOrderSchemaFactory, 'pos_orders');
}

class PosOrderRepository {
  static model(conn) { return PosOrder(conn); }

  static async create(conn, payload, options = {}) {
    return PosOrder(conn).create(payload, options);
  }
}

module.exports = PosOrderRepository;
