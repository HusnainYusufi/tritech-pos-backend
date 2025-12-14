'use strict';

const AppError = require('../../../modules/AppError');
const RecipeRepo = require('../repository/recipe.repository');

const DEFAULT_YIELD = 1;

/**
 * Flattens a recipe into inventory-level ingredient usage per output unit.
 * - Resolves nested sub-recipes recursively.
 * - Guards against cyclic references.
 * - Scales quantities based on the requested multiplier and recipe yield.
 *
 * @param {Connection} conn Mongoose connection
 * @param {String|ObjectId} recipeId Recipe identifier
 * @param {Number} multiplier Number of recipe output units needed (defaults to 1)
 * @param {Set<string>} visited Internal cycle guard
 * @returns {Promise<Array<{ itemId: ObjectId, qty: number, fromRecipeId: ObjectId }>>}
 */
async function flattenRecipeConsumption(conn, recipeId, multiplier = 1, visited = new Set()) {
  const recipeKey = String(recipeId);
  if (visited.has(recipeKey)) {
    throw new AppError('Recipe cycle detected in ingredients', 400);
  }
  visited.add(recipeKey);

  const recipe = await RecipeRepo.getById(conn, recipeId);
  if (!recipe) throw new AppError('Recipe not found', 404);
  if (!recipe.isActive) throw new AppError('Recipe is inactive', 400);

  const yieldSize = Number(recipe.yield) > 0 ? Number(recipe.yield) : DEFAULT_YIELD;
  const perUnitFactor = multiplier / yieldSize;

  const aggregate = new Map();

  for (const ing of recipe.ingredients || []) {
    const ingQty = Number(ing.quantity) || 0;
    if (ingQty <= 0) continue;

    if (ing.sourceType === 'inventory') {
      const key = String(ing.sourceId);
      const existing = aggregate.get(key) || { itemId: ing.sourceId, qty: 0, fromRecipeId: recipe._id };
      existing.qty += ingQty * perUnitFactor;
      aggregate.set(key, existing);
    } else if (ing.sourceType === 'recipe') {
      const nested = await flattenRecipeConsumption(
        conn,
        ing.sourceId,
        ingQty * perUnitFactor,
        visited,
      );
      for (const n of nested) {
        const key = String(n.itemId);
        const existing = aggregate.get(key) || { itemId: n.itemId, qty: 0, fromRecipeId: n.fromRecipeId };
        existing.qty += n.qty;
        aggregate.set(key, existing);
      }
    }
  }

  visited.delete(recipeKey);
  return Array.from(aggregate.values());
}

module.exports = {
  flattenRecipeConsumption,
};

