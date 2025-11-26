'use strict';

const AppError = require('../../../modules/AppError');
const BranchInventoryRepo = require('../repository/branchInventory.repository');
const InventoryItemRepo = require('../../inventory/repository/inventoryItem.repository');
const BranchRepo = require('../../branch/repository/branch.repository');

class BranchInventoryService {
  /**
   * Create branch-level inventory entry
   * - Validates branch
   * - Validates master inventory item
   * - Prevents duplicates per (branchId, itemId)
   * - Adds branch to InventoryItem.branches[]
   */
  static async create(conn, tenantSlug, d) {
    if (!d.branchId) throw new AppError('branchId is required', 400);
    if (!d.itemId) throw new AppError('itemId is required', 400);

    // Ensure branch exists for this tenant
    const branch = await BranchRepo.getById(conn, d.branchId);
    if (!branch) throw new AppError('Branch not found', 404);

    // Ensure master inventory item exists
    const item = await InventoryItemRepo.getById(conn, d.itemId);
    if (!item) throw new AppError('Inventory item not found', 404);

    // Optional: block service/non-stock items if you want
    if (item.type === 'service') {
      throw new AppError('Service items cannot have branch inventory', 400);
    }

    // Guard: no duplicate mappings
    const existing = await BranchInventoryRepo.findOneByBranchAndItem(
      conn,
      d.branchId,
      d.itemId,
    );
    if (existing) throw new AppError('Branch inventory item already exists', 409);

    const doc = await BranchInventoryRepo.create(conn, {
      branchId: d.branchId,
      itemId: d.itemId,
      itemNameSnapshot: item.name,
      skuSnapshot: item.sku || '',

      quantity: Number(d.quantity || 0),
      reorderPoint: Number(d.reorderPoint || 0),
      minStock: Number(d.minStock || 0),
      maxStock: Number(d.maxStock || 0),

      costPerUnit: Number(d.costPerUnit || 0),
      sellingPrice: Number(d.sellingPrice || 0),

      isActive: d.isActive !== undefined ? !!d.isActive : true,
      metadata: d.metadata || {},
    });

    // Maintain reverse reference on the master inventory item
    const branches = Array.isArray(item.branches) ? item.branches : [];
    const hasBranch = branches.some((b) => String(b) === String(d.branchId));

    if (!hasBranch) {
      // Add branchId to InventoryItem.branches (using $addToSet semantics)
      await InventoryItemRepo.updateById(conn, item._id, {
        $addToSet: { branches: d.branchId },
      });
    }

    return { status: 200, message: 'Branch inventory item created', result: doc };
  }

  /**
   * Update branch-level stock & pricing
   */
  static async update(conn, id, patch) {
    const cur = await BranchInventoryRepo.getById(conn, id);
    if (!cur) throw new AppError('Branch inventory item not found', 404);

    // Do not allow remapping branch/item from here (safety)
    if (patch.branchId && String(patch.branchId) !== String(cur.branchId)) {
      throw new AppError('branchId cannot be changed', 400);
    }
    if (patch.itemId && String(patch.itemId) !== String(cur.itemId)) {
      throw new AppError('itemId cannot be changed', 400);
    }

    const upd = {};

    if (patch.quantity !== undefined) upd.quantity = Number(patch.quantity);
    if (patch.reorderPoint !== undefined) upd.reorderPoint = Number(patch.reorderPoint);
    if (patch.minStock !== undefined) upd.minStock = Number(patch.minStock);
    if (patch.maxStock !== undefined) upd.maxStock = Number(patch.maxStock);
    if (patch.costPerUnit !== undefined) upd.costPerUnit = Number(patch.costPerUnit);
    if (patch.sellingPrice !== undefined) upd.sellingPrice = Number(patch.sellingPrice);
    if (patch.isActive !== undefined) upd.isActive = !!patch.isActive;
    if (patch.metadata !== undefined) upd.metadata = patch.metadata;

    const doc = await BranchInventoryRepo.updateById(conn, id, upd);
    if (!doc) throw new AppError('Branch inventory item not found', 404);

    return { status: 200, message: 'Branch inventory item updated', result: doc };
  }

  /**
   * Get one branch inventory record
   */
  static async get(conn, id) {
    const doc = await BranchInventoryRepo.getById(conn, id);
    if (!doc) throw new AppError('Branch inventory item not found', 404);
    return { status: 200, message: 'OK', result: doc };
  }

  /**
   * List items for a branch (requires branchId)
   * q = search by snapshot name or SKU
   */
  static async list(conn, q) {
    if (!q || !q.branchId) {
      throw new AppError('branchId is required', 400);
    }

    const out = await BranchInventoryRepo.search(conn, q || {});
    return { status: 200, message: 'OK', ...out };
  }

  /**
   * Delete mapping
   * (Does NOT delete master inventory item)
   */
  static async del(conn, id) {
    const doc = await BranchInventoryRepo.deleteById(conn, id);
    if (!doc) throw new AppError('Branch inventory item not found', 404);
    return { status: 200, message: 'Branch inventory item deleted' };
  }
}

module.exports = BranchInventoryService;
