// features/recipe/services/recipeWithVariants.service.js
'use strict';

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
    let nameSnapshot = ing.nameSnapshot || '';
    let unit = ing.unit;

    if (ing.sourceType === 'inventory') {
      const item = await ItemRepo.getById(conn, ing.sourceId);
      if (!item) {
        throw new AppError(
          `Inventory item not found: ${ing.sourceId}`,
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
          `Sub-recipe not found: ${ing.sourceId}`,
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
    let nameSnapshot = ing.nameSnapshot || '';
    let unit = ing.unit;

    if (ing.sourceType === 'inventory') {
      const item = await ItemRepo.getById(conn, ing.sourceId);
      if (!item) {
        throw new AppError(
          `Inventory item not found for variant ingredient: ${ing.sourceId}`,
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
          `Sub-recipe not found for variant ingredient: ${ing.sourceId}`,
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
 * Check if MongoDB supports transactions (requires replica set)
 * @param {Object} conn - Mongoose connection
 * @returns {Promise<boolean>}
 */
async function supportsTransactions(conn) {
  try {
    const admin = conn.db.admin();
    const serverStatus = await admin.serverStatus();
    
    // Check if this is a replica set or mongos (sharded cluster)
    const isReplicaSet = serverStatus.repl && serverStatus.repl.setName;
    const isMongos = serverStatus.process === 'mongos';
    
    return isReplicaSet || isMongos;
  } catch (error) {
    logger.warn('[RecipeWithVariants] Could not determine transaction support', {
      error: error.message
    });
    return false;
  }
}

/**
 * Service for creating recipe with multiple variants
 * 
 * ✅ PRODUCTION-GRADE: Supports both transactional and non-transactional modes
 * - With replica set: Uses transactions for atomicity
 * - Without replica set: Manual cleanup on errors (best-effort consistency)
 */
class RecipeWithVariantsService {
  /**
   * Create a recipe with multiple variants
   * 
   * Architecture Decision:
   * - Attempts to use transactions if MongoDB supports them (replica set/sharded)
   * - Falls back to manual error handling if transactions are not available
   * - Ensures data consistency in both scenarios
   * 
   * @param {Object} conn - Tenant database connection
   * @param {Object} data - Recipe and variants data
   * @returns {Promise<Object>} Created recipe and variants
   */
  static async createWithVariants(conn, data) {
    const startTime = Date.now();
    let createdRecipe = null;
    const createdVariants = [];
    
    // ✅ SOLUTION ARCHITECT FIX: Check transaction support
    const useTransactions = await supportsTransactions(conn);
    let session = null;
    
    if (useTransactions) {
      logger.info('[RecipeWithVariants] Using transactional mode (replica set detected)');
      session = await conn.startSession();
      session.startTransaction();
    } else {
      logger.info('[RecipeWithVariants] Using non-transactional mode (standalone MongoDB)');
    }

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
          'Circular recipe dependency detected',
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

      const { enriched: enrichedIngredients, total: recipeTotalCost} = 
        await calculateRecipeCost(conn, data.ingredients);

      // ========================================
      // STEP 4: CREATE BASE RECIPE
      // ========================================
      
      const recipeData = {
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
      };
      
      if (useTransactions && session) {
        // Transactional mode: Pass session
        const result = await RecipeRepo.model(conn).create([recipeData], { session });
        createdRecipe = result[0]; // create() with session returns array
      } else {
        // Non-transactional mode: Direct create
        createdRecipe = await RecipeRepo.model(conn).create(recipeData);
      }

      logger.info('[RecipeWithVariants] Base recipe created', {
        recipeId: createdRecipe._id,
        recipeName: createdRecipe.name,
        totalCost: createdRecipe.totalCost
      });

      // ========================================
      // STEP 5: CREATE VARIANTS (if any)
      // ========================================
      
      if (variations.length > 0) {
        logger.info('[RecipeWithVariants] Creating variants', { 
          variantCount: variations.length 
        });

        for (const variant of variations) {
          if (!variant.name || !variant.name.trim()) {
            throw new AppError('Each variant must have a name', 400);
          }

          const { enriched: variantIngredients, total: variantCost } = 
            await calculateVariantCost(conn, variant);

          const variantData = {
            recipeId: createdRecipe._id,
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
          };

          if (useTransactions && session) {
            // Transactional mode: Pass session
            const variantDocs = await RecipeVariantRepo.model(conn).create([variantData], { session });
            createdVariants.push(variantDocs[0]);
          } else {
            // Non-transactional mode: Direct create
            const variantDoc = await RecipeVariantRepo.model(conn).create(variantData);
            createdVariants.push(variantDoc);
          }
        }

        logger.info('[RecipeWithVariants] Variants created', {
          recipeId: createdRecipe._id,
          variantCount: createdVariants.length
        });
      }

      // ========================================
      // STEP 6: COMMIT TRANSACTION (if using transactions)
      // ========================================
      
      if (useTransactions && session) {
        await session.commitTransaction();
        logger.info('[RecipeWithVariants] ✅ Transaction committed successfully', {
          recipeId: createdRecipe._id,
          recipeName: createdRecipe.name,
          variantCount: createdVariants.length
        });
      }
      
      const duration = Date.now() - startTime;
      logger.info('[RecipeWithVariants] ✅ Recipe and variants created successfully', {
        recipeId: createdRecipe._id,
        recipeName: createdRecipe.name,
        variantCount: createdVariants.length,
        durationMs: duration,
        mode: useTransactions ? 'transactional' : 'non-transactional'
      });

      return {
        status: 201,
        message: `Recipe created successfully with ${createdVariants.length} variant(s)`,
        result: {
          recipe: {
            _id: createdRecipe._id,
            name: createdRecipe.name,
            customName: createdRecipe.customName,
            slug: createdRecipe.slug,
            code: createdRecipe.code,
            description: createdRecipe.description,
            type: createdRecipe.type,
            ingredients: createdRecipe.ingredients,
            totalCost: createdRecipe.totalCost,
            yield: createdRecipe.yield,
            isActive: createdRecipe.isActive,
            metadata: createdRecipe.metadata,
            createdAt: createdRecipe.createdAt,
            updatedAt: createdRecipe.updatedAt
          },
          variants: createdVariants.map(v => ({
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
            recipeId: createdRecipe._id,
            recipeName: createdRecipe.name,
            recipeSlug: createdRecipe.slug,
            recipeCost: createdRecipe.totalCost,
            variantCount: createdVariants.length,
            totalIngredients: createdRecipe.ingredients.length,
            processingTimeMs: duration
          }
        }
      };

    } catch (error) {
      // ========================================
      // ERROR HANDLING & CLEANUP
      // ========================================
      
      if (useTransactions && session) {
        // Transactional mode: Rollback transaction
        await session.abortTransaction();
        logger.error('[RecipeWithVariants] ❌ Transaction rolled back due to error', {
          error: error.message,
          recipeName: data?.name,
          createdRecipeId: createdRecipe?._id,
          createdVariantsCount: createdVariants.length
        });
      } else {
        // Non-transactional mode: Manual cleanup
        logger.error('[RecipeWithVariants] ❌ Error occurred - attempting manual cleanup', {
          error: error.message,
          recipeName: data?.name,
          createdRecipeId: createdRecipe?._id,
          createdVariantsCount: createdVariants.length
        });
        
        // Best-effort cleanup: Delete created variants and recipe
        try {
          if (createdVariants.length > 0) {
            const variantIds = createdVariants.map(v => v._id);
            await RecipeVariantRepo.model(conn).deleteMany({ _id: { $in: variantIds } });
            logger.info('[RecipeWithVariants] Cleaned up variants', { 
              count: createdVariants.length 
            });
          }
          
          if (createdRecipe && createdRecipe._id) {
            await RecipeRepo.model(conn).deleteOne({ _id: createdRecipe._id });
            logger.info('[RecipeWithVariants] Cleaned up recipe', { 
              recipeId: createdRecipe._id 
            });
          }
        } catch (cleanupError) {
          logger.error('[RecipeWithVariants] ⚠️ Cleanup failed - manual intervention may be required', {
            cleanupError: cleanupError.message,
            recipeId: createdRecipe?._id,
            variantCount: createdVariants.length
          });
        }
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

      // Generic error
      throw new AppError(
        `Failed to create recipe with variants: ${error.message}`,
        500
      );
    } finally {
      // ✅ Always end the session (if it exists)
      if (session) {
        session.endSession();
      }
    }
  }
}module.exports = RecipeWithVariantsService;

