const { getTenantModel } = require('../../../modules/tenantModels');
const schemaFactory = require('../model/InventoryCategory.schema');

function InventoryCategory(conn) {
  return getTenantModel(conn, 'InventoryCategory', schemaFactory, 'inventory_categories');
}

class InventoryCategoryRepository {
  static model(conn) { return InventoryCategory(conn); }

  static async create(conn, d) { return InventoryCategory(conn).create(d); }
  static async updateById(conn, id, d) { return InventoryCategory(conn).findByIdAndUpdate(id, d, { new: true }); }
  static async getById(conn, id) { return InventoryCategory(conn).findById(id).lean(); }
  static async getBySlug(conn, slug) { return InventoryCategory(conn).findOne({ slug }).lean(); }
  static async deleteById(conn, id) { return InventoryCategory(conn).findByIdAndDelete(id); }

  // Added for import/export
  static async listAll(conn) {
    return InventoryCategory(conn).find({}).select('name slug isActive').lean();
  }
  static async getByNameCI(conn, name) {
    if (!name) return null;
    return InventoryCategory(conn).findOne({ name: { $regex: `^${String(name).trim()}$`, $options: 'i' } }).lean();
  }

  static async search(conn, { q, parentId, isActive, page=1, limit=20, sort='displayOrder', order='asc' }) {
    const filter = {};
    if (q) filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { slug: { $regex: q, $options: 'i' } },
      { code: { $regex: q, $options: 'i' } }
    ];
    if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === true;
    if (parentId) filter.parentId = parentId;

    const skip = (Number(page)-1)*Number(limit);
    const sortObj = { [sort]: order==='asc' ? 1 : -1 };

    const M = InventoryCategory(conn);
    const [items, count] = await Promise.all([
      M.find(filter).sort(sortObj).skip(skip).limit(Number(limit)).lean(),
      M.countDocuments(filter)
    ]);

    return { items, count, page:Number(page), limit:Number(limit) };
  }
}

module.exports = InventoryCategoryRepository;
