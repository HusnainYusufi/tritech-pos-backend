'use strict';

const AppError = require('../../../modules/AppError');
const RecipeRepo = require('../../recipe/repository/recipe.repository');
const RecipeVariantRepo = require('../repository/recipeVariant.repository');
const ItemRepo = require('../../inventory/repository/inventoryItem.repository');

async function calculateVariantCost(conn, variant) {
  let total = 0;
  const enriched = [];

  for (const ing of (variant.ingredients || [])) {
    let costPerUnit = ing.costPerUnit || 0;
    let nameSnapshot = ing.nameSnapshot;

    if (ing.sourceType === 'inventory') {
      const item = await ItemRepo.getById(conn, ing.sourceId);
      if (!item) throw new AppError(`Inventory item not found for ${nameSnapshot || ing.sourceId}`, 404);
      nameSnapshot = item.name;
      if (!ing.unit) ing.unit = item.baseUnit || '';
    } else if (ing.sourceType === 'recipe') {
      const rec = await RecipeRepo.getById(conn, ing.sourceId);
      if (!rec) throw new AppError(`Sub-recipe not found for ${nameSnapshot || ing.sourceId}`, 404);
      nameSnapshot = rec.name;
      costPerUnit = rec.totalCost;
    }

    const totalCost = Number(ing.quantity || 0) * Number(costPerUnit || 0);
    total += totalCost;

    enriched.push({ ...ing, nameSnapshot, costPerUnit, totalCost });
  }

  total = total * (variant.sizeMultiplier || 1) + (variant.baseCostAdjustment || 0);
  return { enriched, total };
}

class RecipeVariantService {
  /**
   * Create variant(s):
   * - If recipeId is a string: create one variant
   * - If recipeId is an array: create the same variant for each recipeId
   */
  static async create(conn, d) {
    const ids = Array.isArray(d.recipeId) ? d.recipeId : [d.recipeId];

    // Validate all base recipes exist first (fail-fast with helpful message)
    const missing = [];
    for (const id of ids) {
      const base = await RecipeRepo.getById(conn, id);
      if (!base) missing.push(id);
    }
    if (missing.length) {
      throw new AppError(`Base recipe(s) not found: ${missing.join(', ')}`, 404);
    }

    // Pre-calc cost/ingredients once; reuse for each create
    const { enriched, total } = await calculateVariantCost(conn, d);

    const results = [];
    for (const rid of ids) {
      const doc = await RecipeVariantRepo.create(conn, {
        recipeId: rid,
        name: d.name,
        description: d.description || '',
        type: d.type || 'custom',
        sizeMultiplier: Number(d.sizeMultiplier || 1),
        baseCostAdjustment: Number(d.baseCostAdjustment || 0),
        crustType: d.crustType || '',
        ingredients: enriched,
        totalCost: total,
        isActive: d.isActive !== undefined ? !!d.isActive : true,
        metadata: d.metadata || {}
      });
      results.push(doc);
    }

    return {
      status: 200,
      message: `Variant created for ${results.length} recipe(s)`,
      result: { items: results, count: results.length }
    };
  }

  static async update(conn, id, patch) {
    const cur = await RecipeVariantRepo.getById(conn, id);
    if (!cur) throw new AppError('Variant not found', 404);

    if (patch.ingredients || patch.sizeMultiplier !== undefined || patch.baseCostAdjustment !== undefined) {
      const { enriched, total } = await calculateVariantCost(conn, { ...cur, ...patch });
      patch.ingredients = enriched;
      patch.totalCost = total;
    }

    const doc = await RecipeVariantRepo.updateById(conn, id, patch);
    return { status: 200, message: 'Variant updated', result: doc };
  }

  static async list(conn, q) {
    const out = await RecipeVariantRepo.search(conn, q || {});
    return { status: 200, message: 'OK', ...out };
  }

  static async get(conn, id) {
    const doc = await RecipeVariantRepo.getById(conn, id);
    if (!doc) throw new AppError('Variant not found', 404);
    return { status: 200, message: 'OK', result: doc };
  }

  static async del(conn, id) {
    const doc = await RecipeVariantRepo.deleteById(conn, id);
    if (!doc) throw new AppError('Variant not found', 404);
    return { status: 200, message: 'Variant deleted' };
  }
}

module.exports = RecipeVariantService;
