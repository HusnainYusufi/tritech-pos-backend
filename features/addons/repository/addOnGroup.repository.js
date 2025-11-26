'use strict';
const { getTenantModel } = require('../../../modules/tenantModels');
const schemaFactory = require('../model/AddOnGroup.schema');

function AddOnGroup(conn) {
  return getTenantModel(conn, 'AddOnGroup', schemaFactory, 'addon_groups');
}

class AddOnGroupRepository {
  static model(conn) { return AddOnGroup(conn); }

  static async create(conn, d) { return AddOnGroup(conn).create(d); }
  static async updateById(conn, id, d) { return AddOnGroup(conn).findByIdAndUpdate(id, d, { new: true }); }
  static async getById(conn, id) { return AddOnGroup(conn).findById(id).lean(); }
  static async deleteById(conn, id) { return AddOnGroup(conn).findByIdAndDelete(id); }

  static async search(conn, { q, categoryId, isActive, page=1, limit=50, sort='displayOrder', order='asc' } = {}) {
    const filter = {};
    if (q) filter.name = { $regex: q, $options: 'i' };
    if (categoryId) filter.categoryId = categoryId;
    if (isActive !== undefined) filter.isActive = (isActive === 'true' || isActive === true);

    const skip = (Number(page)-1)*Number(limit);
    const sortObj = { [sort]: order === 'asc' ? 1 : -1 };

    const [items, count] = await Promise.all([
      AddOnGroup(conn).find(filter).sort(sortObj).skip(skip).limit(Number(limit)).lean(),
      AddOnGroup(conn).countDocuments(filter)
    ]);

    return { items, count, page:Number(page), limit:Number(limit) };
  }

  static async existsItemsUnderGroup(conn, groupId, ItemRepo) {
    return ItemRepo.existsByGroup(conn, groupId);
  }
}

module.exports = AddOnGroupRepository;
