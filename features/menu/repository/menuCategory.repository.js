'use strict';

const { getTenantModel } = require('../../../modules/tenantModels');
const schemaFactory = require('../model/MenuCategory.schema');

function MenuCategory(conn) {
  return getTenantModel(conn, 'MenuCategory', schemaFactory, 'menu_categories');
}

class MenuCategoryRepository {
  static model(conn) { return MenuCategory(conn); }

  static async create(conn, d) { return MenuCategory(conn).create(d); }
  static async updateById(conn, id, d) { return MenuCategory(conn).findByIdAndUpdate(id, d, { new: true }); }
  static async getById(conn, id) { return MenuCategory(conn).findById(id).lean(); }
  static async getBySlug(conn, slug) { return MenuCategory(conn).findOne({ slug }).lean(); }
  static async deleteById(conn, id) { return MenuCategory(conn).findByIdAndDelete(id); }

  static async search(conn, { q, parentId, isActive, page=1, limit=20, sort='displayOrder', order='asc' } = {}) {
    const filter = {};
    if (q) filter.$or = [{ name: { $regex: q, $options: 'i' } }, { slug: { $regex: q, $options: 'i' } }, { code: { $regex: q, $options: 'i' } }];
    if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === true;
    if (parentId) filter.parentId = parentId;

    const skip = (Number(page)-1)*Number(limit);
    const sortObj = { [sort]: order === 'asc' ? 1 : -1 };
    const [items, count] = await Promise.all([
      MenuCategory(conn).find(filter).sort(sortObj).skip(skip).limit(Number(limit)).lean(),
      MenuCategory(conn).countDocuments(filter)
    ]);
    return { items, count, page:Number(page), limit:Number(limit) };
  }

  static async hasChildren(conn, id) {
    return MenuCategory(conn).exists({ parentId: id });
  }
}

module.exports = MenuCategoryRepository;
