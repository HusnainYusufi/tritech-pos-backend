const AppError = require('../../../modules/AppError');
const ItemRepo = require('../repository/inventoryItem.repository');
const CategoryRepo = require('../../inventory-category/repository/inventoryCategory.repository');
const { nextSku } = require('../../../modules/sku');
const mongoose = require('mongoose');

class InventoryItemService {
  static async create(conn, tenantSlug, d) {
  if (!d.name) throw new AppError('name required', 400);

  // Validate tenantSlug is provided
  if (!tenantSlug || typeof tenantSlug !== 'string' || tenantSlug.trim() === '') {
    throw new AppError('tenantSlug is required', 400);
  }

  let categoryNameSnapshot = '';
  if (d.categoryId) {
    // Validate ObjectId format before querying to avoid CastError
    if (!mongoose.Types.ObjectId.isValid(d.categoryId)) {
      throw new AppError('Invalid categoryId format', 400);
    }
    try {
      const cat = await CategoryRepo.getById(conn, d.categoryId);
      if (!cat) throw new AppError('Category not found', 404);
      categoryNameSnapshot = cat.name;
    } catch (error) {
      // Handle Mongoose CastError or other database errors
      if (error.name === 'CastError' || error.message?.includes('Cast to ObjectId')) {
        throw new AppError('Invalid categoryId format', 400);
      }
      // Re-throw AppError as-is, otherwise wrap unexpected errors
      if (error instanceof AppError) throw error;
      throw new AppError('Category lookup failed', 500);
    }
  }

  let sku;
  if (d.sku && d.sku.trim()) {
    sku = d.sku.trim();
  } else {
    try {
      sku = await nextSku(conn, tenantSlug);
    } catch (error) {
      // Handle counter-related errors with helpful messages
      if (error.code === 11000 || error.message?.includes('duplicate key')) {
        const logger = require('../../../modules/logger');
        logger.error('[InventoryItemService] Counter duplicate key error', {
          tenantSlug,
          error: error.message,
          stack: error.stack
        });
        throw new AppError(
          'SKU generation failed due to counter conflict. Please run the fix script: node scripts/fix-counters-collection.js ' + tenantSlug,
          500
        );
      }
      // Re-throw other errors
      throw error;
    }
  }

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
        // Validate ObjectId format before querying to avoid CastError
        if (!mongoose.Types.ObjectId.isValid(patch.categoryId)) {
          throw new AppError('Invalid categoryId format', 400);
        }
        try {
          const cat = await CategoryRepo.getById(conn, patch.categoryId);
          if (!cat) throw new AppError('Category not found', 404);
          upd.categoryNameSnapshot = cat.name;
        } catch (error) {
          // Handle Mongoose CastError or other database errors
          if (error.name === 'CastError' || error.message?.includes('Cast to ObjectId')) {
            throw new AppError('Invalid categoryId format', 400);
          }
          // Re-throw AppError as-is, otherwise wrap unexpected errors
          if (error instanceof AppError) throw error;
          throw new AppError('Category lookup failed', 500);
        }
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
