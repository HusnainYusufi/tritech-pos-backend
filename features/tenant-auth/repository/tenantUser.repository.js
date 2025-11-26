const { getTenantModel } = require('../../../modules/tenantModels');
const userSchemaFactory = require('../model/TenantUser.schema');

function User(conn) {
  return getTenantModel(conn, 'TenantUser', userSchemaFactory, 'tenant_users');
}

class TenantUserRepository {
  static async create(conn, data) { return User(conn).create(data); }
  static async getByEmail(conn, email) { return User(conn).findOne({ email }).lean(); }
  static async getDocByEmail(conn, email) { return User(conn).findOne({ email }); }
  static async updateById(conn, id, patch) { return User(conn).findByIdAndUpdate(id, patch, { new: true }); }
  static async getById(conn, id) { return User(conn).findById(id).lean(); }
  static model(conn) { return User(conn); }
}

module.exports = TenantUserRepository;
