'use strict';

const { getTenantModel } = require('../../../modules/tenantModels');
const factory = require('../model/BranchInventory.schema');
const BranchRepo = require('../../branch/repository/branch.repository')
const InventoryItemRepo = require('../../inventory/repository/inventoryItem.repository')

function BranchInventory(conn) {
  // collection name: branch_inventory
  return getTenantModel(conn, 'BranchInventory', factory, 'branch_inventory');
}

class BranchInventoryRepository {
  static model(conn) {
    return BranchInventory(conn);
  }

  static async create(conn, data) {
    return BranchInventory(conn).create(data);
  }

  static async updateById(conn, id, patch) {
    return BranchInventory(conn).findByIdAndUpdate(id, patch, { new: true });
  }

  static async getById(conn, id) {
    return BranchInventory(conn).findById(id).lean();
  }

  static async deleteById(conn, id) {
    return BranchInventory(conn).findByIdAndDelete(id);
  }

  static async findOneByBranchAndItem(conn, branchId, itemId) {
    return BranchInventory(conn).findOne({ branchId, itemId }).lean();
  }

  static async search(
    conn,
    {
      branchId,
      q,
      isActive,
      page = 1,
      limit = 50,
      sort = 'createdAt',
      order = 'desc',
    } = {}
  ) {
    const filter = {};

    if (branchId) filter.branchId = branchId;

    if (q) {
      filter.$or = [
        { itemNameSnapshot: { $regex: q, $options: 'i' } },
        { skuSnapshot: { $regex: q, $options: 'i' } },
      ];
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true' || isActive === true;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sortObj = { [sort]: order === 'asc' ? 1 : -1 };

   
    const [rows, count] = await Promise.all([
      BranchInventory(conn)
        .find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      BranchInventory(conn).countDocuments(filter),
    ]);

    if (!rows.length) {
      return { items: [], count, page: Number(page), limit: Number(limit) };
    }

   
    const branchIds = [...new Set(rows.map(r => String(r.branchId)))];
    const itemIds = [...new Set(rows.map(r => String(r.itemId)))];

  
    const [branches, items] = await Promise.all([
      BranchRepo.findManyByIds(conn, branchIds),
      InventoryItemRepo.findManyByIds(conn, itemIds),
    ]);

    const branchMap = new Map(branches.map(b => [String(b._id), b]));
    const itemMap = new Map(items.map(i => [String(i._id), i]));

   
    const final = rows.map(r => {
      const { branchId, itemId, itemNameSnapshot, skuSnapshot, ...clean } = r;

      return {
        ...clean,            
        branch: branchMap.get(String(branchId)) || null,
        item: itemMap.get(String(itemId)) || null,
      };
    });

    return {
      items: final,
      count,
      page: Number(page),
      limit: Number(limit),
    };
  }



}

module.exports = BranchInventoryRepository;
