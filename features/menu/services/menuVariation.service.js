'use strict';

/**
 * MenuVariationService - Production-grade service for menu variations
 * 
 * Handles creation and management of menu variations with proper validation,
 * recipe variant linking, and cost calculation for enterprise POS systems.
 * 
 * @module features/menu/services/menuVariation
 */

const AppError = require('../../../modules/AppError');
const logger = require('../../../modules/logger');
const Repo = require('../repository/menuVariation.repository');
const ItemRepo = require('../repository/menuItem.repository');
const RecipeRepo = require('../../recipe/repository/recipe.repository');
const RecipeVariantRepo = require('../../recipe-variant/repository/recipeVariant.repository');

class MenuVariationService {
  /**
   * Create a menu variation with full validation and recipe variant linking
   * 
   * This is the production-grade implementation that ensures:
   * - Menu item exists and has a recipe
   * - No duplicate variation names for the same menu item
   * - Recipe variant belongs to the correct recipe
   * - Cost is calculated accurately
   * - Warns if selling below cost
   * 
   * @param {Object} conn - Tenant database connection
   * @param {Object} d - Variation data
   * @returns {Promise<Object>} Created variation
   */
  static async create(conn, d) {
    // 1. Validate required fields
    if (!d.menuItemId) throw new AppError('menuItemId required', 400);
    if (!d.name || !String(d.name).trim()) {
      throw new AppError('Variation name is required', 400);
    }

    const variationName = String(d.name).trim();

    // 2. Validate menu item exists and has recipe
    const menuItem = await ItemRepo.getById(conn, d.menuItemId);
    if (!menuItem) throw new AppError('Menu item not found', 404);

    if (!menuItem.recipeId) {
      throw new AppError(
        'Cannot add variations to menu item without recipe. Please link a recipe first.',
        400
      );
    }

    // 3. Check for duplicate variation name for this menu item
    const existing = await Repo.model(conn).findOne({
      menuItemId: d.menuItemId,
      name: variationName
    }).lean();

    if (existing) {
      throw new AppError(
        `Variation "${variationName}" already exists for this menu item`,
        409
      );
    }

    // 4. Validate and link recipe variant (if provided)
    let calculatedCost = 0;
    
    if (d.recipeVariantId) {
      const recipeVariant = await RecipeVariantRepo.getById(conn, d.recipeVariantId);
      if (!recipeVariant) {
        throw new AppError('Recipe variant not found', 404);
      }

      // Ensure recipe variant belongs to this menu item's recipe
      if (String(recipeVariant.recipeId) !== String(menuItem.recipeId)) {
        throw new AppError(
          'Recipe variant does not belong to this menu item\'s recipe',
          400
        );
      }

      // Calculate actual cost based on variation type
      const baseRecipe = await RecipeRepo.getById(conn, menuItem.recipeId);
      const baseCost = baseRecipe.totalCost || 0;

      if (d.type === 'size') {
        // Size variations multiply the entire base cost
        calculatedCost = baseCost * (recipeVariant.sizeMultiplier || 1);
      } else {
        // Flavor/addon variations add to the base cost
        calculatedCost = baseCost + (recipeVariant.totalCost || 0);
      }

      // Warn if selling at a loss
      const sellingPrice = (menuItem.pricing?.basePrice || 0) + (d.priceDelta || 0);
      if (sellingPrice < calculatedCost) {
        logger.warn('[MenuVariation] WARNING: Selling below cost!', {
          menuItemId: d.menuItemId,
          menuItemName: menuItem.name,
          variationName,
          cost: calculatedCost,
          price: sellingPrice,
          loss: calculatedCost - sellingPrice,
          lossPercent: ((calculatedCost - sellingPrice) / calculatedCost * 100).toFixed(2)
        });
      }

      logger.info('[MenuVariation] Recipe variant linked', {
        menuItemId: d.menuItemId,
        variationName,
        recipeVariantId: d.recipeVariantId,
        calculatedCost,
        type: d.type
      });
    }
    // Legacy: calculate from ingredients array
    else if (d.ingredients && Array.isArray(d.ingredients) && d.ingredients.length > 0) {
      for (const ing of d.ingredients) {
        calculatedCost += (ing.quantity || 0) * (ing.costPerUnit || 0);
      }
      
      logger.info('[MenuVariation] Using legacy ingredients array', {
        menuItemId: d.menuItemId,
        variationName,
        ingredientCount: d.ingredients.length,
        calculatedCost
      });
    }

    // 5. Create variation with all validations passed
    const doc = await Repo.create(conn, {
      menuItemId: d.menuItemId,
      recipeVariantId: d.recipeVariantId || null,
      name: variationName,
      type: d.type || 'custom',
      priceDelta: Number(d.priceDelta || 0),
      costDelta: Number(d.costDelta || 0), // deprecated, kept for backward compatibility
      calculatedCost: Number(calculatedCost.toFixed(4)),
      sizeMultiplier: Number(d.sizeMultiplier || 1),
      crustType: d.crustType || '',
      flavorTag: d.flavorTag || '',
      ingredients: Array.isArray(d.ingredients) ? d.ingredients : [],
      isDefault: !!d.isDefault,
      isActive: d.isActive !== undefined ? !!d.isActive : true,
      displayOrder: Number(d.displayOrder || 0),
      metadata: d.metadata || {}
    });

    // ✅ CRITICAL FIX: Auto-populate MenuItem.variants[] array for bidirectional linking
    // This ensures MenuItem.variants[] stays in sync with MenuVariation.menuItemId
    try {
      await ItemRepo.model(conn).findByIdAndUpdate(
        d.menuItemId,
        { $addToSet: { variants: doc._id } },
        { new: false } // Don't need the updated doc, just fire and continue
      );
      
      logger.info('[MenuVariation] Auto-linked to MenuItem.variants[]', {
        variationId: doc._id,
        menuItemId: d.menuItemId,
        variationName: doc.name
      });
    } catch (linkError) {
      // Non-fatal: Log but don't fail the creation
      logger.error('[MenuVariation] Failed to auto-link to MenuItem.variants[]', {
        variationId: doc._id,
        menuItemId: d.menuItemId,
        error: linkError.message
      });
    }

    logger.info('[MenuVariation] Created successfully', {
      variationId: doc._id,
      menuItemId: d.menuItemId,
      variationName: doc.name,
      type: doc.type,
      priceDelta: doc.priceDelta,
      calculatedCost: doc.calculatedCost
    });

    return { 
      status: 201, 
      message: 'Menu variation created', 
      result: doc 
    };
  }

  /**
   * Update a menu variation with validation
   */
  static async update(conn, id, patch) {
    const current = await Repo.getById(conn, id);
    if (!current) throw new AppError('Menu variation not found', 404);

    // Validate menu item if being changed
    if (patch.menuItemId && String(patch.menuItemId) !== String(current.menuItemId)) {
      const mi = await ItemRepo.getById(conn, patch.menuItemId);
      if (!mi) throw new AppError('Menu item not found', 404);
    }

    // Check for duplicate name if name is being changed
    if (patch.name && patch.name !== current.name) {
      const menuItemId = patch.menuItemId || current.menuItemId;
      const existing = await Repo.model(conn).findOne({
        menuItemId,
        name: patch.name,
        _id: { $ne: id }
      }).lean();

      if (existing) {
        throw new AppError(
          `Variation "${patch.name}" already exists for this menu item`,
          409
        );
      }
    }

    // Recalculate cost if recipe variant is being changed
    if (patch.recipeVariantId) {
      const menuItem = await ItemRepo.getById(conn, current.menuItemId);
      const recipeVariant = await RecipeVariantRepo.getById(conn, patch.recipeVariantId);
      
      if (!recipeVariant) {
        throw new AppError('Recipe variant not found', 404);
      }

      if (String(recipeVariant.recipeId) !== String(menuItem.recipeId)) {
        throw new AppError(
          'Recipe variant does not belong to this menu item\'s recipe',
          400
        );
      }

      const baseRecipe = await RecipeRepo.getById(conn, menuItem.recipeId);
      const baseCost = baseRecipe.totalCost || 0;
      const varType = patch.type || current.type;

      if (varType === 'size') {
        patch.calculatedCost = baseCost * (recipeVariant.sizeMultiplier || 1);
      } else {
        patch.calculatedCost = baseCost + (recipeVariant.totalCost || 0);
      }
    }

    const doc = await Repo.updateById(conn, id, patch);
    
    logger.info('[MenuVariation] Updated successfully', {
      variationId: id,
      updates: Object.keys(patch)
    });

    return { status: 200, message: 'Menu variation updated', result: doc };
  }

  static async get(conn, id) {
    const doc = await Repo.getById(conn, id);
    if (!doc) throw new AppError('Menu variation not found', 404);
    return { status: 200, message: 'OK', result: doc };
  }

  static async list(conn, q) {
    const out = await Repo.search(conn, q || {});
    return { status: 200, message: 'OK', ...out };
  }

  static async listByMenuItem(conn, menuItemId, q) {
    const out = await Repo.listByMenuItem(conn, menuItemId, q || {});
    return { status: 200, message: 'OK', ...out };
  }

  static async del(conn, id) {
    const doc = await Repo.getById(conn, id);
    if (!doc) throw new AppError('Menu variation not found', 404);

    const menuItemId = doc.menuItemId;

    // Delete the variation
    await Repo.deleteById(conn, id);

    // ✅ CRITICAL FIX: Remove from MenuItem.variants[] array to maintain bidirectional sync
    try {
      await ItemRepo.model(conn).findByIdAndUpdate(
        menuItemId,
        { $pull: { variants: id } },
        { new: false }
      );

      logger.info('[MenuVariation] Auto-unlinked from MenuItem.variants[]', {
        variationId: id,
        menuItemId,
        variationName: doc.name
      });
    } catch (unlinkError) {
      // Non-fatal: Log but don't fail the deletion
      logger.error('[MenuVariation] Failed to auto-unlink from MenuItem.variants[]', {
        variationId: id,
        menuItemId,
        error: unlinkError.message
      });
    }

    return { status: 200, message: 'Menu variation deleted' };
  }
}

module.exports = MenuVariationService;
