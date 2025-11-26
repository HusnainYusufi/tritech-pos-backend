'use strict';

const AppError = require('../../../modules/AppError');
const GroupRepo = require('../repository/addOnGroup.repository');
const ItemRepo  = require('../repository/addOnItem.repository');
const CategoryRepo = require('../../menu/repository/menuCategory.repository');

class AddOnsService {
  // GROUPS
  static async createGroup(conn, d) {
    const cat = await CategoryRepo.getById(conn, d.categoryId);
    if (!cat) throw new AppError('Category not found', 404);

    const doc = await GroupRepo.create(conn, {
      categoryId: d.categoryId,
      name: d.name.trim(),
      description: d.description || '',
      isActive: d.isActive !== undefined ? !!d.isActive : true,
      displayOrder: Number(d.displayOrder || 0),
      metadata: d.metadata || {}
    });
    return { status: 200, message: 'Group created', result: doc };
  }

  static async updateGroup(conn, id, patch) {
    const cur = await GroupRepo.getById(conn, id);
    if (!cur) throw new AppError('Group not found', 404);

    if (patch.categoryId) {
      const cat = await CategoryRepo.getById(conn, patch.categoryId);
      if (!cat) throw new AppError('Category not found', 404);
    }
    const doc = await GroupRepo.updateById(conn, id, patch);
    return { status: 200, message: 'Group updated', result: doc };
  }

  static async listGroups(conn, q) {
    const out = await GroupRepo.search(conn, q || {});
    return { status: 200, message: 'OK', ...out };
  }

  static async getGroup(conn, id) {
    const doc = await GroupRepo.getById(conn, id);
    if (!doc) throw new AppError('Group not found', 404);
    return { status: 200, message: 'OK', result: doc };
  }

  static async deleteGroup(conn, id) {
    const cur = await GroupRepo.getById(conn, id);
    if (!cur) throw new AppError('Group not found', 404);

    const hasItems = await GroupRepo.existsItemsUnderGroup(conn, id, ItemRepo);
    if (hasItems) throw new AppError('Cannot delete group with items', 400);

    await GroupRepo.deleteById(conn, id);
    return { status: 200, message: 'Group deleted' };
  }

  // ITEMS
  static async createItem(conn, d) {
    // validate group & category alignment
    const grp = await GroupRepo.getById(conn, d.groupId);
    if (!grp) throw new AppError('Group not found', 404);
    if (String(grp.categoryId) !== String(d.categoryId))
      throw new AppError('categoryId must match group.categoryId', 400);

    const doc = await ItemRepo.create(conn, {
      groupId: d.groupId,
      categoryId: d.categoryId,
      sourceType: d.sourceType,
      sourceId: d.sourceId,
      nameSnapshot: d.nameSnapshot,
      price: Number(d.price || 0),
      unit: d.unit || 'unit',
      isRequired: !!d.isRequired,
      isActive: d.isActive !== undefined ? !!d.isActive : true,
      displayOrder: Number(d.displayOrder || 0),
      metadata: d.metadata || {}
    });
    return { status: 200, message: 'Item created', result: doc };
  }

  static async bulkCreateItems(conn, d) {
    const grp = await GroupRepo.getById(conn, d.groupId);
    if (!grp) throw new AppError('Group not found', 404);
    if (String(grp.categoryId) !== String(d.categoryId))
      throw new AppError('categoryId must match group.categoryId', 400);

    const docs = (d.items || []).map(it => ({
      groupId: d.groupId,
      categoryId: d.categoryId,
      sourceType: it.sourceType,
      sourceId: it.sourceId,
      nameSnapshot: it.nameSnapshot,
      price: Number(it.price || 0),
      unit: it.unit || 'unit',
      isRequired: !!it.isRequired,
      isActive: it.isActive !== undefined ? !!it.isActive : true,
      displayOrder: Number(it.displayOrder || 0),
      metadata: it.metadata || {}
    }));

    const res = await ItemRepo.createMany(conn, docs);
    return { status: 200, message: 'Items created', result: res };
  }

  static async updateItem(conn, id, patch) {
    if (patch.groupId || patch.categoryId) {
      // if moving, ensure alignment
      const grpId = patch.groupId;
      const catId = patch.categoryId;
      if (grpId || catId) {
        const grp = await GroupRepo.getById(conn, grpId || (await ItemRepo.getById(conn, id))?.groupId);
        if (!grp) throw new AppError('Group not found', 404);
        const effectiveCat = catId || (await ItemRepo.getById(conn, id))?.categoryId;
        if (String(grp.categoryId) !== String(effectiveCat))
          throw new AppError('categoryId must match group.categoryId', 400);
      }
    }
    const doc = await ItemRepo.updateById(conn, id, patch);
    if (!doc) throw new AppError('Item not found', 404);
    return { status: 200, message: 'Item updated', result: doc };
  }

  static async listItems(conn, q) {
    const out = await ItemRepo.search(conn, q || {});
    return { status: 200, message: 'OK', ...out };
  }

  static async getItem(conn, id) {
    const doc = await ItemRepo.getById(conn, id);
    if (!doc) throw new AppError('Item not found', 404);
    return { status: 200, message: 'OK', result: doc };
  }

  static async deleteItem(conn, id) {
    const doc = await ItemRepo.deleteById(conn, id);
    if (!doc) throw new AppError('Item not found', 404);
    return { status: 200, message: 'Item deleted' };
  }

  // CONFIG for POS: groups + items by category
  static async getConfigByCategory(conn, categoryId) {
    const cat = await CategoryRepo.getById(conn, categoryId);
    if (!cat) throw new AppError('Category not found', 404);

    const groups = (await GroupRepo.search(conn, { categoryId, isActive: true, page:1, limit:1000, sort:'displayOrder', order:'asc' })).items;
    const out = [];
    for (const g of groups) {
      const items = (await ItemRepo.search(conn, { groupId: String(g._id), isActive: true, page:1, limit:2000, sort:'displayOrder', order:'asc' })).items;
      out.push({ group: g, items });
    }
    return { status: 200, message: 'OK', result: { category: cat, groups: out } };
  }
}

module.exports = AddOnsService;
