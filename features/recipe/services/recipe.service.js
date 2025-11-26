'use strict';

const AppError = require('../../../modules/AppError');
const RecipeRepo = require('../repository/recipe.repository');
const ItemRepo = require('../../inventory/repository/inventoryItem.repository');

// 👇 adjust this path if your variant repo is elsewhere
const RecipeVariantRepo = require('../../recipe-variant/repository/recipeVariant.repository');

/** Utility to slugify */
function toSlug(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseBool(v, def = true) {
  if (v === undefined || v === null || v === '') return def;
  const s = String(v).trim().toLowerCase();
  if (['true','1','yes','y'].includes(s)) return true;
  if (['false','0','no','n'].includes(s)) return false;
  return def;
}

/** Prevent circular references in sub-recipes */
async function detectCircular(conn, parentId, subRecipeIds) {
  for (const id of subRecipeIds) {
    if (String(id) === String(parentId)) return true;
    const sub = await RecipeRepo.getById(conn, id);
    if (sub && sub.ingredients?.length) {
      const childIds = sub.ingredients
        .filter(i => i.sourceType === 'recipe')
        .map(i => i.sourceId);
      if (await detectCircular(conn, parentId, childIds)) return true;
    }
  }
  return false;
}

/** Calculate total cost and validate unit consistency */
async function calculateCost(conn, ingredients) {
  let total = 0;
  const enriched = [];

  for (const ing of ingredients) {
    let costPerUnit = ing.costPerUnit || 0;
    let nameSnapshot = ing.nameSnapshot;
    let unit = ing.unit;

    if (ing.sourceType === 'inventory') {
      const item = await ItemRepo.getById(conn, ing.sourceId);
      if (!item) throw new AppError(`Inventory item not found for ingredient ${nameSnapshot}`, 404);

      nameSnapshot = item.name;

      // ✅ enforce consistent unit usage
      const baseUnit = item.baseUnit || '';
      if (baseUnit && ing.unit !== baseUnit) {
        throw new AppError(`Unit mismatch for ${item.name}: must use ${baseUnit}`, 400);
      }

      unit = baseUnit || ing.unit;
      costPerUnit = ing.costPerUnit ?? item.metadata?.costPerUnit ?? 0;

    } else if (ing.sourceType === 'recipe') {
      const rec = await RecipeRepo.getById(conn, ing.sourceId);
      if (!rec) throw new AppError(`Sub-recipe not found for ingredient ${nameSnapshot}`, 404);

      nameSnapshot = rec.name;
      costPerUnit = rec.totalCost; // treat entire sub-recipe as one unit
    }

    const totalCost = Number(ing.quantity || 0) * Number(costPerUnit || 0);
    total += totalCost;

    enriched.push({
      ...ing,
      nameSnapshot,
      unit,
      costPerUnit,
      totalCost,
    });
  }

  return { enriched, total };
}

class RecipeService {
  /** Create recipe */
  static async create(conn, d) {
    const name = String(d.name || '').trim();
    if (!name) throw new AppError('name required', 400);

    const slug = d.slug ? toSlug(d.slug) : toSlug(name);
    const exists = await RecipeRepo.getBySlug(conn, slug);
    if (exists) throw new AppError('Recipe slug already exists', 409);

    // detect circular reference
    const subRecipeIds = (d.ingredients || [])
      .filter(i => i.sourceType === 'recipe')
      .map(i => i.sourceId);
    if (await detectCircular(conn, null, subRecipeIds))
      throw new AppError('Circular recipe dependency detected', 400);

    // calculate cost + validate units
    const { enriched, total } = await calculateCost(conn, d.ingredients || []);

    const doc = await RecipeRepo.create(conn, {
      name,
      customName: d.customName || '',
      slug,
      code: d.code || '',
      description: d.description || '',
      type: d.type || 'final',
      ingredients: enriched,
      totalCost: total,
      yield: d.yield || 1,
      isActive: d.isActive !== undefined ? !!d.isActive : true,
      metadata: d.metadata || {},
    });

    return { status: 200, message: 'Recipe created', result: doc };
  }

  /** Update recipe */
  static async update(conn, id, patch) {
    const cur = await RecipeRepo.getById(conn, id);
    if (!cur) throw new AppError('Recipe not found', 404);

    if (patch.slug) {
      const s = toSlug(patch.slug);
      const dup = await RecipeRepo.getBySlug(conn, s);
      if (dup && String(dup._id) !== String(id))
        throw new AppError('Slug already exists', 409);
      patch.slug = s;
    } else if (patch.name) {
      patch.slug = toSlug(patch.name);
    }

    if (patch.ingredients) {
      const subRecipeIds = patch.ingredients
        .filter(i => i.sourceType === 'recipe')
        .map(i => i.sourceId);
      if (await detectCircular(conn, id, subRecipeIds))
        throw new AppError('Circular recipe dependency detected', 400);

      const { enriched, total } = await calculateCost(conn, patch.ingredients);
      patch.ingredients = enriched;
      patch.totalCost = total;
    }

    const doc = await RecipeRepo.updateById(conn, id, patch);
    return { status: 200, message: 'Recipe updated', result: doc };
  }

  /** Get one recipe */
  static async get(conn, id) {
    const doc = await RecipeRepo.getById(conn, id);
    if (!doc) throw new AppError('Recipe not found', 404);
    return { status: 200, message: 'OK', result: doc };
  }

  /** List recipes */
  static async list(conn, q) {
    const out = await RecipeRepo.search(conn, q || {});
    return { status: 200, message: 'OK', ...out };
  }

  /** Delete recipe */
  static async del(conn, id) {
    const doc = await RecipeRepo.deleteById(conn, id);
    if (!doc) throw new AppError('Recipe not found', 404);
    return { status: 200, message: 'Recipe deleted' };
  }

  /** ---------------- NEW: bundles ---------------- */

  static async getWithVariantsById(conn, id, q = {}) {
    const recipe = await RecipeRepo.getById(conn, id);
    if (!recipe) throw new AppError('Recipe not found', 404);

    const activeOnly = parseBool(q.activeOnly, true);
    const page  = Number(q.page || 1);
    const limit = Number(q.limit || 50);
    const sort  = q.sort || 'createdAt';
    const order = q.order === 'asc' ? 'asc' : 'desc';

    const searchQ = {
      recipeId: id,
      isActive: activeOnly ? true : undefined,
      page, limit, sort, order
    };

    const variantsPage = await RecipeVariantRepo.search(conn, searchQ);

    return {
      status: 200,
      message: 'OK',
      result: {
        recipe,
        variants: variantsPage.items,
        count: variantsPage.count,
        page: variantsPage.page,
        limit: variantsPage.limit
      }
    };
  }

  static async getWithVariantsBySlug(conn, slug, q = {}) {
    const recipe = await RecipeRepo.getBySlug(conn, slug);
    if (!recipe) throw new AppError('Recipe not found', 404);
    return this.getWithVariantsById(conn, recipe._id, q);
  }
}

module.exports = RecipeService;
