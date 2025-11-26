'use strict';

const { getTenantModel } = require('../../../modules/tenantModels');
const schemaFactory = require('../model/MenuVariation.schema');
const menuItemSchema = require('../model/MenuItem.schema');

function MenuVariation(conn) {
  return getTenantModel(conn, 'MenuVariation', schemaFactory, 'menu_variations');
}

class MenuVariationRepository {
  static model(conn) { return MenuVariation(conn); }

  static async create(conn, d) { return MenuVariation(conn).create(d); }
  static async updateById(conn, id, d) { return MenuVariation(conn).findByIdAndUpdate(id, d, { new: true }); }
  static async getById(conn, id) {
    getTenantModel(conn, 'MenuItem', menuItemSchema, 'menu_items');
    return MenuVariation(conn).findById(id)
      .populate('menuItemId','name slug')
      .lean();
  }
  static async deleteById(conn, id) { return MenuVariation(conn).findByIdAndDelete(id); }

  static async listByMenuItem(conn, menuItemId, { page=1, limit=50, sort='displayOrder', order='asc' } = {}) {
    const skip = (Number(page)-1)*Number(limit);
    const sortObj = { [sort]: order === 'asc' ? 1 : -1 };
    return {
      items: await MenuVariation(conn).find({ menuItemId }).sort(sortObj).skip(skip).limit(Number(limit)).lean(),
      count: await MenuVariation(conn).countDocuments({ menuItemId }),
      page: Number(page),
      limit: Number(limit)
    };
  }

  static async search(conn, { q, menuItemId, isActive, page=1, limit=20, sort='displayOrder', order='asc' } = {}) {
    const filter = {};
    if (menuItemId) filter.menuItemId = menuItemId;
    if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === true;
    if (q) filter.$or = [{ name: { $regex: q, $options: 'i' } }, { type: { $regex: q, $options: 'i' } }];

    const skip = (Number(page)-1)*Number(limit);
    const sortObj = { [sort]: order === 'asc' ? 1 : -1 };
    const [items, count] = await Promise.all([
      MenuVariation(conn).find(filter).sort(sortObj).skip(skip).limit(Number(limit)).lean(),
      MenuVariation(conn).countDocuments(filter)
    ]);
    return { items, count, page:Number(page), limit:Number(limit) };
  }
}

module.exports = MenuVariationRepository;
