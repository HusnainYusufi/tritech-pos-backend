const AppError = require('../../../modules/AppError');
const ItemRepo = require('../repository/inventoryItem.repository');
const CategoryRepo = require('../../inventory-category/repository/inventoryCategory.repository');
const { nextSku } = require('../../../modules/sku');

class InventoryItemService {
  static async create(conn, tenantSlug, d) {
  if (!d.name) throw new AppError('name required', 400);

  let categoryNameSnapshot = '';
  if (d.categoryId) {
    const cat = await CategoryRepo.getById(conn, d.categoryId);
    if (!cat) throw new AppError('Category not found', 404);
    categoryNameSnapshot = cat.name;
  }

  const sku = d.sku && d.sku.trim()
    ? d.sku.trim()
    : await nextSku(conn, tenantSlug);

  // enforce unique sku (rare race can be caught by unique index)
  const dup = await ItemRepo.getBySku(conn, sku);
  if (dup) throw new AppError('SKU already exists', 409);

  // ✅ unify units from both API and Excel import
  const baseUnit = d.baseUnit || d.usageUnit || '';
  const purchaseUnit = d.purchaseUnit || baseUnit || '';
  const conversion = Number(d.conversion || 1);

  const doc = await ItemRepo.create(conn, {
    name: d.name,
    sku,
    type: d.type || 'stock',
    isActive: d.isActive !== undefined ? !!d.isActive : true,

    categoryId: d.categoryId || null,
    categoryNameSnapshot,

    baseUnit,
    purchaseUnit,
    conversion,

    reorderPoint: Number(d.reorderPoint || 0),
    quantity: Number(d.quantity || 0),

    branches: Array.isArray(d.branches) ? d.branches : [],

    notes: d.notes || '',
    metadata: d.metadata || {}
  });

  return { status: 200, message: 'Item created', result: doc };
}


  static async update(conn, id, patch) {
    if (patch.sku) {
      // optional manual change
      const exists = await ItemRepo.getBySku(conn, patch.sku);
      if (exists && String(exists._id) !== String(id)) throw new AppError('SKU already exists', 409);
    }

    const upd = { ...patch };

    if (patch.categoryId !== undefined) {
      if (!patch.categoryId) {
        upd.categoryId = null;
        upd.categoryNameSnapshot = '';
      } else {
        const cat = await CategoryRepo.getById(conn, patch.categoryId);
        if (!cat) throw new AppError('Category not found', 404);
        upd.categoryNameSnapshot = cat.name;
      }
    }

    const doc = await ItemRepo.updateById(conn, id, upd);
    if (!doc) throw new AppError('Item not found', 404);
    return { status: 200, message: 'Item updated', result: doc };
  }

  static async get(conn, id) {
    const doc = await ItemRepo.getById(conn, id);
    if (!doc) throw new AppError('Item not found', 404);
    return { status: 200, message: 'OK', result: doc };
  }

  static async list(conn, q) {
    const out = await ItemRepo.search(conn, q || {});
    return { status: 200, message: 'OK', ...out };
  }

  static async del(conn, id) {
    const doc = await ItemRepo.deleteById(conn, id);
    if (!doc) throw new AppError('Item not found', 404);
    return { status: 200, message: 'Item deleted' };
  }

    static async getStats(conn) {
    const stats = await ItemRepo.getInventoryStats(conn);
    return {
      status: 200,
      message: 'OK',
      result: stats
    };
  }

}

module.exports = InventoryItemService;
