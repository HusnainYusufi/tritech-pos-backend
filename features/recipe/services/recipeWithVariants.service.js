// features/recipe/services/recipeWithVariants.service.js
'use strict';

const mongoose = require('mongoose');
const AppError = require('../../../modules/AppError');
const logger = require('../../../modules/logger');
const RecipeRepo = require('../repository/recipe.repository');
const RecipeVariantRepo = require('../../recipe-variant/repository/recipeVariant.repository');
const ItemRepo = require('../../inventory/repository/inventoryItem.repository');

/** Utility to slugify */
function toSlug(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '');
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

/** 
 * Calculate recipe cost and enrich ingredients with name snapshots
 * @returns {Object} { enriched: Array, total: Number }
 */
async function calculateRecipeCost(conn, ingredients) {
  let total = 0;
  const enriched = [];

  for (const ing of ingredients) {
    let costPerUnit = ing.costPerUnit || 0;
    let nameSnapshot = ing.nameSnapshot;
    let unit = ing.unit;

    if (ing.sourceType === 'inventory') {
      const item = await ItemRepo.getById(conn, ing.sourceId);
      if (!item) {
        throw new AppError(
          `Inventory item not found: ${nameSnapshot || ing.sourceId}`,
          404
        );
      }

      nameSnapshot = item.name;
      const baseUnit = item.baseUnit || '';
      
      // Enforce unit consistency
      if (baseUnit && ing.unit !== baseUnit) {
        throw new AppError(
          `Unit mismatch for "${item.name}": expected ${baseUnit}, got ${ing.unit}`,
          400
        );
      }

      unit = baseUnit || ing.unit;
      costPerUnit = ing.costPerUnit ?? item.metadata?.costPerUnit ?? 0;

    } else if (ing.sourceType === 'recipe') {
      const rec = await RecipeRepo.getById(conn, ing.sourceId);
      if (!rec) {
        throw new AppError(
          `Sub-recipe not found: ${nameSnapshot || ing.sourceId}`,
          404
        );
      }

      nameSnapshot = rec.name;
      costPerUnit = rec.totalCost;
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

/**
 * Calculate variant cost with size multiplier and adjustments
 * @returns {Object} { enriched: Array, total: Number }
 */
async function calculateVariantCost(conn, variant) {
  let total = 0;
  const enriched = [];

  for (const ing of (variant.ingredients || [])) {
    let costPerUnit = ing.costPerUnit || 0;
    let nameSnapshot = ing.nameSnapshot;
    let unit = ing.unit;

    if (ing.sourceType === 'inventory') {
      const item = await ItemRepo.getById(conn, ing.sourceId);
      if (!item) {
        throw new AppError(
          `Inventory item not found for variant ingredient: ${nameSnapshot || ing.sourceId}`,
          404
        );
      }
      nameSnapshot = item.name;
      unit = item.baseUnit || ing.unit;
      costPerUnit = ing.costPerUnit ?? item.metadata?.costPerUnit ?? 0;

    } else if (ing.sourceType === 'recipe') {
      const rec = await RecipeRepo.getById(conn, ing.sourceId);
      if (!rec) {
        throw new AppError(
          `Sub-recipe not found for variant ingredient: ${nameSnapshot || ing.sourceId}`,
          404
        );
      }
      nameSnapshot = rec.name;
      costPerUnit = rec.totalCost;
    }

    const totalCost = Number(ing.quantity || 0) * Number(costPerUnit || 0);
    total += totalCost;

    enriched.push({ ...ing, nameSnapshot, unit, costPerUnit, totalCost });
  }

  // Apply size multiplier and base cost adjustment
  total = total * (variant.sizeMultiplier || 1) + (variant.baseCostAdjustment || 0);
  
  return { enriched, total };
}

/**
 * Validate all variant names are unique
 */
function validateUniqueVariantNames(variants) {
  const names = variants.map(v => String(v.name || '').trim().toLowerCase());
  const duplicates = names.filter((name, idx) => names.indexOf(name) !== idx);
  
  if (duplicates.length > 0) {
    throw new AppError(
      `Duplicate variant names detected: ${[...new Set(duplicates)].join(', ')}`,
      400
    );
  }
}

/**
 * Production-grade service for creating recipe with multiple variants atomically
 */
class RecipeWithVariantsService {
  /**
   * Create a recipe with multiple variants in a single atomic transaction
   * 
   * @param {Connection} conn - Tenant database connection
   * @param {Object} data - Recipe and variants data
   * @param {string} data.name - Recipe name
   * @param {string} [data.customName] - Custom display name
   * @param {string} [data.slug] - URL-friendly slug (auto-generated if not provided)
   * @param {string} [data.code] - Recipe code/SKU
   * @param {string} [data.description] - Recipe description
   * @param {string} [data.type='final'] - Recipe type: 'sub' or 'final'
   * @param {Array} data.ingredients - Array of ingredient objects
   * @param {number} [data.yield=1] - Recipe yield quantity
   * @param {boolean} [data.isActive=true] - Active status
   * @param {Object} [data.metadata] - Additional metadata
   * @param {Array} [data.variations=[]] - Array of variation objects
   * 
   * @returns {Promise<Object>} Result with recipe and created variants
   */
  static async createWithVariants(conn, data) {
    const startTime = Date.now();
    let session = null;

    try {
      // ========================================
      // STEP 1: VALIDATION
      // ========================================
      
      const name = String(data.name || '').trim();
      if (!name) {
        throw new AppError('Recipe name is required', 400);
      }

      if (!data.ingredients || !Array.isArray(data.ingredients) || data.ingredients.length === 0) {
        throw new AppError('Recipe must have at least one ingredient', 400);
      }

      const variations = Array.isArray(data.variations) ? data.variations : [];
      
      // Validate unique variant names
      if (variations.length > 0) {
        validateUniqueVariantNames(variations);
      }

      // Generate slug
      const slug = data.slug ? toSlug(data.slug) : toSlug(name);

      // Check slug uniqueness
      const existingRecipe = await RecipeRepo.getBySlug(conn, slug);
      if (existingRecipe) {
        throw new AppError(
          `Recipe with slug "${slug}" already exists`,
          409
        );
      }

      // ========================================
      // STEP 2: DETECT CIRCULAR DEPENDENCIES
      // ========================================
      
      const subRecipeIds = data.ingredients
        .filter(i => i.sourceType === 'recipe')
        .map(i => i.sourceId);

      if (await detectCircular(conn, null, subRecipeIds)) {
        throw new AppError(
          'Circular recipe dependency detected. A recipe cannot reference itself directly or indirectly.',
          400
        );
      }

      // ========================================
      // STEP 3: CALCULATE BASE RECIPE COST
      // ========================================
      
      logger.info('[RecipeWithVariants] Calculating base recipe cost', { 
        recipeName: name, 
        ingredientCount: data.ingredients.length 
      });

      const { enriched: enrichedIngredients, total: recipeTotalCost } = 
        await calculateRecipeCost(conn, data.ingredients);

      // ========================================
      // STEP 4: PRE-CALCULATE ALL VARIANT COSTS
      // ========================================
      
      const enrichedVariants = [];

      if (variations.length > 0) {
        logger.info('[RecipeWithVariants] Pre-calculating variant costs', { 
          variantCount: variations.length 
        });

        for (const variant of variations) {
          if (!variant.name || !variant.name.trim()) {
            throw new AppError('Each variant must have a name', 400);
          }

          const { enriched: variantIngredients, total: variantCost } = 
            await calculateVariantCost(conn, variant);

          enrichedVariants.push({
            name: String(variant.name).trim(),
            description: variant.description || '',
            type: variant.type || 'custom',
            sizeMultiplier: Number(variant.sizeMultiplier || 1),
            baseCostAdjustment: Number(variant.baseCostAdjustment || 0),
            crustType: variant.crustType || '',
            ingredients: variantIngredients,
            totalCost: variantCost,
            isActive: variant.isActive !== undefined ? !!variant.isActive : true,
            metadata: variant.metadata || {}
          });
        }
      }

      // ========================================
      // STEP 5: ENSURE MODELS ARE REGISTERED
      // ========================================
      
      // Pre-register models on the connection before starting transaction
      const Recipe = RecipeRepo.model(conn);
      const RecipeVariant = RecipeVariantRepo.model(conn);

      // ========================================
      // STEP 6: START TRANSACTION
      // ========================================
      
      session = await conn.startSession();
      session.startTransaction();

      logger.info('[RecipeWithVariants] Starting atomic transaction', {
        recipeName: name,
        variantCount: enrichedVariants.length
      });

      // ========================================
      // STEP 7: CREATE BASE RECIPE
      // ========================================
      
      const [recipeDoc] = await Recipe.create([{
        name,
        customName: data.customName || '',
        slug,
        code: data.code || '',
        description: data.description || '',
        type: data.type || 'final',
        ingredients: enrichedIngredients,
        totalCost: recipeTotalCost,
        yield: Number(data.yield || 1),
        isActive: data.isActive !== undefined ? !!data.isActive : true,
        metadata: data.metadata || {},
      }], { session });

      logger.info('[RecipeWithVariants] Base recipe created', {
        recipeId: recipeDoc._id,
        recipeName: recipeDoc.name,
        totalCost: recipeDoc.totalCost
      });

      // ========================================
      // STEP 8: BULK CREATE VARIANTS
      // ========================================
      
      let variantDocs = [];

      if (enrichedVariants.length > 0) {
        // Prepare bulk insert data
        const variantInsertData = enrichedVariants.map(v => ({
          recipeId: recipeDoc._id,
          name: v.name,
          description: v.description,
          type: v.type,
          sizeMultiplier: v.sizeMultiplier,
          baseCostAdjustment: v.baseCostAdjustment,
          crustType: v.crustType,
          ingredients: v.ingredients,
          totalCost: v.totalCost,
          isActive: v.isActive,
          metadata: v.metadata
        }));

        // Bulk insert all variants
        variantDocs = await RecipeVariant.create(variantInsertData, { session });

        logger.info('[RecipeWithVariants] Variants created', {
          recipeId: recipeDoc._id,
          variantCount: variantDocs.length
        });
      }

      // ========================================
      // STEP 9: COMMIT TRANSACTION
      // ========================================
      
      await session.commitTransaction();
      
      const duration = Date.now() - startTime;
      logger.info('[RecipeWithVariants] Transaction committed successfully', {
        recipeId: recipeDoc._id,
        recipeName: recipeDoc.name,
        variantCount: variantDocs.length,
        durationMs: duration
      });

      // ========================================
      // STEP 10: RETURN RESULT
      // ========================================
      
      return {
        status: 201,
        message: `Recipe created successfully with ${variantDocs.length} variant(s)`,
        result: {
          recipe: {
            _id: recipeDoc._id,
            name: recipeDoc.name,
            customName: recipeDoc.customName,
            slug: recipeDoc.slug,
            code: recipeDoc.code,
            description: recipeDoc.description,
            type: recipeDoc.type,
            ingredients: recipeDoc.ingredients,
            totalCost: recipeDoc.totalCost,
            yield: recipeDoc.yield,
            isActive: recipeDoc.isActive,
            metadata: recipeDoc.metadata,
            createdAt: recipeDoc.createdAt,
            updatedAt: recipeDoc.updatedAt
          },
          variants: variantDocs.map(v => ({
            _id: v._id,
            recipeId: v.recipeId,
            name: v.name,
            description: v.description,
            type: v.type,
            sizeMultiplier: v.sizeMultiplier,
            baseCostAdjustment: v.baseCostAdjustment,
            crustType: v.crustType,
            ingredients: v.ingredients,
            totalCost: v.totalCost,
            isActive: v.isActive,
            metadata: v.metadata,
            createdAt: v.createdAt,
            updatedAt: v.updatedAt
          })),
          summary: {
            recipeId: recipeDoc._id,
            recipeName: recipeDoc.name,
            recipeSlug: recipeDoc.slug,
            recipeCost: recipeDoc.totalCost,
            variantCount: variantDocs.length,
            totalIngredients: recipeDoc.ingredients.length,
            processingTimeMs: duration
          }
        }
      };

    } catch (error) {
      // ========================================
      // ERROR HANDLING & ROLLBACK
      // ========================================
      
      if (session && session.inTransaction()) {
        await session.abortTransaction();
        logger.error('[RecipeWithVariants] Transaction aborted due to error', {
          error: error.message,
          stack: error.stack
        });
      }

      // Re-throw AppError as-is
      if (error instanceof AppError) {
        throw error;
      }

      // Handle MongoDB duplicate key errors
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern || {})[0];
        throw new AppError(
          `Duplicate ${field}: A recipe or variant with this ${field} already exists`,
          409
        );
      }

      // Handle validation errors
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(e => e.message);
        throw new AppError(
          `Validation failed: ${messages.join(', ')}`,
          400
        );
      }

      // Generic error - log detailed information for debugging
      logger.error('[RecipeWithVariants] Unexpected error', {
        error: error.message,
        stack: error.stack,
        errorName: error.name,
        errorCode: error.code,
        recipeName: data?.name,
        variantCount: data?.variations?.length || 0
      });

      throw new AppError(
        `Failed to create recipe with variants: ${error.message}`,
        500
      );

    } finally {
      // ========================================
      // CLEANUP
      // ========================================
      
      if (session) {
        await session.endSession();
      }
    }
  }
}

module.exports = RecipeWithVariantsService;

