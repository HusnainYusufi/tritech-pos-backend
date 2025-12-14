const AppError = require('./AppError');
const logger = require('./logger');
const BranchInventoryRepo = require('../features/branch-inventory/repository/branchInventory.repository');
const InventoryTxnRepo = require('../features/inventory/repository/inventoryTxn.repository');
const { flattenRecipeConsumption } = require('../features/recipe/services/recipeConsumption.helper');

async function resolveOrderRequirements(conn, order) {
  const needs = new Map();

  for (const line of order.items || []) {
    if (!line.recipeIdSnapshot) {
      throw new AppError('Menu item is missing a recipe link for inventory deduction', 400);
    }

    const qty = Number(line.quantity) || 0;
    if (qty <= 0) continue;

    const flattened = await flattenRecipeConsumption(conn, line.recipeIdSnapshot, qty);
    for (const ing of flattened) {
      const key = String(ing.itemId);
      const existing = needs.get(key) || { itemId: ing.itemId, qty: 0, recipeIds: new Set() };
      existing.qty += ing.qty;
      existing.recipeIds.add(String(ing.fromRecipeId));
      needs.set(key, existing);
    }
  }

  return Array.from(needs.values()).map((n) => ({ ...n, recipeIds: Array.from(n.recipeIds) }));
}

async function enforceBranchStock(conn, branchId, requirements, { session, orderId, actorId, mode }) {
  if (!requirements.length) return true;

  const itemIds = requirements.map((r) => r.itemId);
  const inventoryDocs = await BranchInventoryRepo.model(conn)
    .find({ branchId, itemId: { $in: itemIds } })
    .session(session || null)
    .lean();

  const inventoryMap = new Map(inventoryDocs.map((d) => [String(d.itemId), d]));

  const updates = [];
  const txns = [];

  for (const req of requirements) {
    const inv = inventoryMap.get(String(req.itemId));
    if (!inv) {
      throw new AppError('Ingredient not assigned to this branch inventory', 422);
    }

    const delta = mode === 'release' ? req.qty : -req.qty;
    const projectedQty = (inv.quantity || 0) + delta;

    if (mode !== 'release' && projectedQty < 0) {
      throw new AppError('Insufficient stock for one or more ingredients', 409);
    }

    updates.push({
      updateOne: {
        filter: { _id: inv._id },
        update: { $inc: { quantity: delta } },
      },
    });

    txns.push({
      branchId,
      itemId: req.itemId,
      type: mode === 'release' ? 'adjust' : 'usage',
      qty: Math.abs(delta),
      ref: {
        orderId: orderId || null,
        note: mode === 'release' ? 'POS order release' : 'POS order usage',
      },
      createdBy: actorId || null,
    });
  }

  if (updates.length) {
    await BranchInventoryRepo.model(conn).bulkWrite(updates, { session: session || null });
  }

  if (txns.length) {
    await InventoryTxnRepo.insertMany(conn, txns, { session: session || null });
  }

  return true;
}

async function reserveStock(conn, tenantSlug, order, opts = {}) {
  try {
    const requirements = await resolveOrderRequirements(conn, order);
    return enforceBranchStock(conn, order.branchId, requirements, { ...opts, mode: 'reserve' });
  } catch (e) {
    logger.error('[inventoryHooks.reserveStock] failed', e);
    throw e;
  }
}

async function deductStock(conn, tenantSlug, order, opts = {}) {
  try {
    const requirements = await resolveOrderRequirements(conn, order);
    return enforceBranchStock(conn, order.branchId, requirements, { ...opts, mode: 'deduct' });
  } catch (e) {
    logger.error('[inventoryHooks.deductStock] failed', e);
    throw e;
  }
}

async function releaseStock(conn, tenantSlug, order, opts = {}) {
  try {
    const requirements = await resolveOrderRequirements(conn, order);
    return enforceBranchStock(conn, order.branchId, requirements, { ...opts, mode: 'release' });
  } catch (e) {
    logger.error('[inventoryHooks.releaseStock] failed', e);
    throw e;
  }
}

module.exports = { reserveStock, deductStock, releaseStock };
