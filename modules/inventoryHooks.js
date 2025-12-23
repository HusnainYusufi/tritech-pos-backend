/**
 * Inventory Hooks - Production-grade inventory management
 * 
 * ✅ CRITICAL FIX: Now handles variations properly for accurate stock deduction
 * 
 * @module modules/inventoryHooks
 */

const AppError = require('./AppError');
const logger = require('./logger');
const BranchInventoryRepo = require('../features/branch-inventory/repository/branchInventory.repository');
const InventoryTxnRepo = require('../features/inventory/repository/inventoryTxn.repository');
const { flattenRecipeConsumption } = require('../features/recipe/services/recipeConsumption.helper');
const RecipeVariantRepo = require('../features/recipe-variant/repository/recipeVariant.repository');

/**
 * Resolve inventory requirements for an order with variation support
 * 
 * ✅ PRODUCTION FIX: Now correctly handles:
 * - Size multipliers (Large = 1.5x ingredients)
 * - Additional ingredients from flavor/topping variations
 * - Proper quantity calculations
 * 
 * @param {Object} conn - Tenant database connection
 * @param {Object} order - POS order with items and variations
 * @returns {Promise<Array>} Inventory requirements
 */
async function resolveOrderRequirements(conn, order) {
  const needs = new Map();

  for (const line of order.items || []) {
    if (!line.recipeIdSnapshot) {
      logger.warn('[InventoryHooks] Menu item missing recipe, skipping inventory deduction', {
        menuItemId: line.menuItemId,
        nameSnapshot: line.nameSnapshot
      });
      continue; // Skip items without recipes (e.g., services)
    }

    const qty = Number(line.quantity) || 0;
    if (qty <= 0) continue;

    // ✅ CRITICAL FIX: Calculate effective multiplier from variations
    let effectiveMultiplier = 1.0;
    const additionalIngredients = [];

    if (line.selectedVariations && line.selectedVariations.length > 0) {
      for (const variation of line.selectedVariations) {
        // Handle size variations (multiply base recipe)
        if (variation.type === 'size' && variation.sizeMultiplier) {
          effectiveMultiplier = variation.sizeMultiplier;
          logger.debug('[InventoryHooks] Size variation detected', {
            variationName: variation.nameSnapshot,
            multiplier: effectiveMultiplier
          });
        }

        // Handle flavor/addon variations (add extra ingredients)
        if (variation.recipeVariantId && variation.type !== 'size') {
          try {
            const recipeVariant = await RecipeVariantRepo.getById(conn, variation.recipeVariantId);
            if (recipeVariant && recipeVariant.ingredients && recipeVariant.ingredients.length > 0) {
              additionalIngredients.push(...recipeVariant.ingredients);
              logger.debug('[InventoryHooks] Additional ingredients from variation', {
                variationName: variation.nameSnapshot,
                ingredientCount: recipeVariant.ingredients.length
              });
            }
          } catch (error) {
            logger.error('[InventoryHooks] Failed to load recipe variant', {
              recipeVariantId: variation.recipeVariantId,
              error: error.message
            });
          }
        }
      }
    }

    // Flatten base recipe with size multiplier applied
    const baseQuantity = qty * effectiveMultiplier;
    const flattened = await flattenRecipeConsumption(conn, line.recipeIdSnapshot, baseQuantity);
    
    // Add base recipe ingredients to needs
    for (const ing of flattened) {
      const key = String(ing.itemId);
      const existing = needs.get(key) || { itemId: ing.itemId, qty: 0, recipeIds: new Set() };
      existing.qty += ing.qty;
      existing.recipeIds.add(String(ing.fromRecipeId));
      needs.set(key, existing);
    }

    // ✅ NEW: Add additional ingredients from variations (also scaled by size)
    for (const extraIng of additionalIngredients) {
      if (extraIng.sourceType === 'inventory') {
        const key = String(extraIng.sourceId);
        const existing = needs.get(key) || { itemId: extraIng.sourceId, qty: 0, recipeIds: new Set() };
        // Additional ingredients are also affected by size multiplier
        existing.qty += (extraIng.quantity || 0) * qty * effectiveMultiplier;
        needs.set(key, existing);
      }
    }

    logger.debug('[InventoryHooks] Order item requirements calculated', {
      menuItemName: line.nameSnapshot,
      quantity: qty,
      sizeMultiplier: effectiveMultiplier,
      variationCount: line.selectedVariations?.length || 0,
      uniqueIngredients: needs.size
    });
  }

  const requirements = Array.from(needs.values()).map((n) => ({ 
    ...n, 
    recipeIds: Array.from(n.recipeIds) 
  }));

  logger.info('[InventoryHooks] Total order requirements', {
    orderNumber: order.orderNumber,
    itemCount: order.items.length,
    uniqueIngredients: requirements.length,
    totalRequirements: requirements.reduce((sum, r) => sum + r.qty, 0)
  });

  return requirements;
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
