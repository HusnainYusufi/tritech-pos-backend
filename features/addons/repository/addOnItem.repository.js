'use strict';
const { getTenantModel } = require('../../../modules/tenantModels');
const schemaFactory = require('../model/AddOnItem.schema');

function AddOnItem(conn) {
  return getTenantModel(conn, 'AddOnItem', schemaFactory, 'addon_items');
}

class AddOnItemRepository {
  static model(conn) { return AddOnItem(conn); }

  static async create(conn, d) { return AddOnItem(conn).create(d); }
  static async createMany(conn, arr) { return AddOnItem(conn).insertMany(arr || []); }
  static async updateById(conn, id, d) { return AddOnItem(conn).findByIdAndUpdate(id, d, { new: true }); }
  static async getById(conn, id) { return AddOnItem(conn).findById(id).lean(); }
  static async deleteById(conn, id) { return AddOnItem(conn).findByIdAndDelete(id); }

  static async existsByGroup(conn, groupId) { return AddOnItem(conn).exists({ groupId }); }

  static async search(conn, { q, groupId, categoryId, isActive, sourceType, page=1, limit=100, sort='displayOrder', order='asc' } = {}) {
    const filter = {};
    if (q) filter.nameSnapshot = { $regex: q, $options: 'i' };
    if (groupId) filter.groupId = groupId;
    if (categoryId) filter.categoryId = categoryId;
    if (sourceType) filter.sourceType = sourceType;
    if (isActive !== undefined) filter.isActive = (isActive === 'true' || isActive === true);

    const skip = (Number(page)-1)*Number(limit);
    const sortObj = { [sort]: order === 'asc' ? 1 : -1 };

    const [items, count] = await Promise.all([
      AddOnItem(conn).find(filter).sort(sortObj).skip(skip).limit(Number(limit)).lean(),
      AddOnItem(conn).countDocuments(filter)
    ]);

    return { items, count, page:Number(page), limit:Number(limit) };
  }
}

module.exports = AddOnItemRepository;
