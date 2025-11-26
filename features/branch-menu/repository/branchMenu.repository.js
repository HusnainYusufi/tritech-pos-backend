// features/branch-menu/repository/branchMenu.repository.js
'use strict';

const { getTenantModel } = require('../../../modules/tenantModels');
const branchMenuSchemaFactory = require('../model/BranchMenu.schema');

function BranchMenu(conn) {
  return getTenantModel(conn, 'BranchMenu', branchMenuSchemaFactory, 'branch_menus');
}

class BranchMenuRepository {
  static model(conn) {
    return BranchMenu(conn);
  }

  static async create(conn, payload) {
    return BranchMenu(conn).create(payload);
  }

  static async updateById(conn, id, payload, expectedVersion) {
    const filter = { _id: id };

    if (typeof expectedVersion === 'number') {
      filter.__v = expectedVersion;
    }

    const update = {
      $set: payload,
      $inc: { __v: 1 },
    };

    return BranchMenu(conn)
      .findOneAndUpdate(filter, update, { new: true, runValidators: true })
      .lean();
  }

  static async findById(conn, id) {
    return BranchMenu(conn).findById(id).lean();
  }

  static async deleteById(conn, id) {
    return BranchMenu(conn).findByIdAndDelete(id).lean();
  }

  static async findOneByBranchAndMenuItem(conn, branchId, menuItemId) {
    return BranchMenu(conn)
      .findOne({ branchId, menuItemId })
      .lean();
  }

  static async listByBranchAndMenuItemIds(conn, branchId, menuItemIds = []) {
    const filter = { branchId };

    if (menuItemIds && menuItemIds.length) {
      filter.menuItemId = { $in: menuItemIds };
    }

    return BranchMenu(conn).find(filter).lean();
  }

  /**
   * Raw search over branch menu configs
   */
  static async search(conn, options = {}) {
    const {
      branchId,
      q,
      categoryId,
      onlyAvailable,
      isVisibleInPOS,
      page = 1,
      limit = 50,
    } = options;

    const filter = {};

    if (branchId) {
      filter.branchId = branchId;
    }

    if (categoryId) {
      filter.categoryId = categoryId;
    }

    if (typeof onlyAvailable === 'boolean') {
      filter.isAvailable = onlyAvailable;
    }

    if (typeof isVisibleInPOS === 'boolean') {
      filter.isVisibleInPOS = isVisibleInPOS;
    }

    if (q && q.trim()) {
      const regex = new RegExp(q.trim(), 'i');
      filter.$or = [
        { menuItemNameSnapshot: regex },
        { menuItemCodeSnapshot: regex },
        { categoryNameSnapshot: regex },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [items, count] = await Promise.all([
      BranchMenu(conn)
        .find(filter)
        .sort({ displayOrder: 1, menuItemNameSnapshot: 1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      BranchMenu(conn).countDocuments(filter),
    ]);

    return {
      items,
      count,
      page: Number(page),
      limit: Number(limit),
    };
  }
}

module.exports = BranchMenuRepository;
