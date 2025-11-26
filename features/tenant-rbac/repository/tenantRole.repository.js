// features/tenant-rbac/repository/tenantRole.repository.js
const { getTenantModel } = require('../../../modules/tenantModels');
const roleSchemaFactory = require('../model/TenantRole.schema');

function Role(conn) {
  return getTenantModel(conn, 'TenantRole', roleSchemaFactory, 'tenant_roles');
}

class TenantRoleRepository {
  static model(conn) { return Role(conn); }
  static async create(conn, d)        { return Role(conn).create(d); }
  static async updateById(conn, id,d) { return Role(conn).findByIdAndUpdate(id,d,{ new:true }); }
  static async getById(conn, id)      { return Role(conn).findById(id).lean(); }
  static async getByKey(conn, key)    { return Role(conn).findOne({ key }).lean(); }
  static async deleteById(conn, id)   { return Role(conn).findByIdAndDelete(id); }
  static async search(conn, { q, page=1, limit=20, sort='createdAt', order='desc' }){
    const filter = {};
    if (q) filter.$or = [{ name: { $regex:q,$options:'i' } }, { key: { $regex:q,$options:'i' } }];
    const skip = (Number(page)-1)*Number(limit);
    const sortObj = { [sort]: order==='asc'?1:-1 };
    const [items, count] = await Promise.all([
      Role(conn).find(filter).sort(sortObj).skip(skip).limit(Number(limit)).lean(),
      Role(conn).countDocuments(filter)
    ]);
    return { items, count, page:Number(page), limit:Number(limit) };
  }
}

module.exports = TenantRoleRepository;
