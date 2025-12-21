'use strict';

const { getTenantModel } = require('../../../modules/tenantModels');
const schemaFactory = require('../model/InventoryItem.schema');

// ✅ bring in InventoryCategory schema for population
const inventoryCategorySchema = require('../../inventory-category/model/InventoryCategory.schema');

function InventoryItem(conn) {
  // collection name: 'inventory_items'
  return getTenantModel(conn, 'InventoryItem', schemaFactory, 'inventory_items');
}

class InventoryItemRepository {
  static model(conn) { return InventoryItem(conn); }

  // === Used by ImportExportService ===
  static async bulkWrite(conn, ops, options = {}) {
    return InventoryItem(conn).bulkWrite(ops, options);
  }

  // For export: simple search with optional category filter
  static async search(conn, { q, categoryId, page = 1, limit = 50, sort = 'createdAt', order = 'desc' } = {}) {
    const filter = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { sku: { $regex: q, $options: 'i' } }
      ];
    }
    if (categoryId) filter.categoryId = categoryId;

    const skip = (Number(page) - 1) * Number(limit);
    const sortObj = { [sort]: order === 'asc' ? 1 : -1 };

    // ✅ ensure InventoryCategory is registered on tenant connection before populate
    getTenantModel(conn, 'InventoryCategory', inventoryCategorySchema, 'inventory_categories');

    const [items, count] = await Promise.all([
      InventoryItem(conn)
        .find(filter)
        .populate('categoryId', 'name slug isActive')   // ✅ Populate category name & slug
        .sort(sortObj)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      InventoryItem(conn).countDocuments(filter)
    ]);

    return { items, count, page: Number(page), limit: Number(limit) };
  }

  // For delete-guard on category removal
  static async countByCategory(conn, categoryId) {
    return InventoryItem(conn).countDocuments({ categoryId });
  }
  static async findManyByIds(conn, ids = []) {
    if (!ids.length) return [];

    // Ensure category model is registered
    getTenantModel(conn, 'InventoryCategory', inventoryCategorySchema, 'inventory_categories');

    return InventoryItem(conn)
      .find({ _id: { $in: ids } })
      .populate('categoryId', 'name slug isActive')
      .lean();
  }


  // (Optional helpers you may want)
  static async create(conn, d) { return InventoryItem(conn).create(d); }
  static async updateById(conn, id, d) { return InventoryItem(conn).findByIdAndUpdate(id, d, { new: true }); }
  static async getById(conn, id) {
    // ✅ Ensure InventoryCategory is registered before populate
    getTenantModel(conn, 'InventoryCategory', inventoryCategorySchema, 'inventory_categories');
    
    // ✅ populate category for single-item fetch too
    return InventoryItem(conn)
      .findById(id)
      .populate('categoryId', 'name slug isActive')
      .lean();
  }
  static async getBySku(conn, sku) { return InventoryItem(conn).findOne({ sku }).lean(); }

  /**
 * Inventory dashboard summary counts
 * @returns {Object} { total, tracked, low, outOfStock }
 */
  static async getInventoryStats(conn) {
    const Item = InventoryItem(conn);

    // total items count
    const total = await Item.countDocuments();

    // stock tracked = items with type = 'stock'
    const tracked = await Item.countDocuments({ type: 'stock' });

    // low stock (reorderPoint > 0 but stock level less than reorderPoint)
    // NOTE: if you later add stock quantities per branch, adjust this query
    const low = await Item.countDocuments({
      type: 'stock',
      isActive: true,
      $expr: { $gt: ['$reorderPoint', 0] },
    });

    // out of stock = reorderPoint > 0 but current stock == 0 (for now, just a placeholder)
    const outOfStock = await Item.countDocuments({
      type: 'stock',
      isActive: true,
      reorderPoint: { $gt: 0 },
    });

    return { total, tracked, low, outOfStock };
  }

}

module.exports = InventoryItemRepository;
