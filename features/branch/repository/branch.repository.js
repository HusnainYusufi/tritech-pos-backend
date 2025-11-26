// features/branch/repository/branch.repository.js
const { getTenantModel } = require('../../../modules/tenantModels');
const branchSchemaFactory = require('../model/Branch.schema');

function Branch(conn) {
  return getTenantModel(conn, 'Branch', branchSchemaFactory, 'branches');
}

class BranchRepository {
  static model(conn){ return Branch(conn); }
  static async findManyByIds(conn, ids = []) {
  if (!ids.length) return [];
  return Branch(conn)
    .find({ _id: { $in: ids } })
    .lean();
}

  static async create(conn, d){ return Branch(conn).create(d); }
  static async updateById(conn, id, d){ return Branch(conn).findByIdAndUpdate(id, d, { new: true }); }
  static async getById(conn, id){ return Branch(conn).findById(id).lean(); }
  static async getByCode(conn, code){ return Branch(conn).findOne({ code: String(code).toLowerCase() }).lean(); }
  static async deleteById(conn, id){ return Branch(conn).findByIdAndDelete(id); }
  static async unsetDefault(conn){ return Branch(conn).updateMany({ isDefault: true }, { $set: { isDefault: false } }); }
  static async count(conn){ return Branch(conn).countDocuments({}); }

  static async search(conn, { q, status, page=1, limit=20, sort='createdAt', order='desc' }){
    const filter = {};
    if (q) filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { code: { $regex: q, $options: 'i' } },
      { 'address.city': { $regex: q, $options: 'i' } }
    ];
    if (status) filter.status = status;

    const skip = (Number(page)-1)*Number(limit);
    const sortObj = { [sort]: order === 'asc' ? 1 : -1 };
    
    const [items, count] = await Promise.all([
      Branch(conn).find(filter).sort(sortObj).skip(skip).limit(Number(limit)).lean(),
      Branch(conn).countDocuments(filter)
    ]);

    return { items, count, page:Number(page), limit:Number(limit) };
  }
}

module.exports = BranchRepository;
