'use strict';

/**
 * MenuCostCalculator Service
 * 
 * Production-grade cost calculation service for menu items with variations.
 * This is the central service used by POS orders to calculate accurate costs
 * for profit margin tracking and inventory deduction.
 * 
 * @module features/menu/services/menuCostCalculator
 * @author Engineering Team
 * @since 2025-01-01
 */

const AppError = require('../../../modules/AppError');
const logger = require('../../../modules/logger');
const MenuItemRepo = require('../repository/menuItem.repository');
const MenuVariationRepo = require('../repository/menuVariation.repository');
const RecipeRepo = require('../../recipe/repository/recipe.repository');
const RecipeVariantRepo = require('../../recipe-variant/repository/recipeVariant.repository');

class MenuCostCalculator {
  /**
   * Calculate total cost for a menu item with selected variations
   * 
   * This is the primary method used during order processing to determine
   * the actual cost of goods sold (COGS) for accurate profit tracking.
   * 
   * @param {Object} conn - Tenant database connection
   * @param {String} menuItemId - Menu item ID
   * @param {Array<String>} selectedVariationIds - Array of selected variation IDs
   * @returns {Promise<Object>} Cost breakdown and total
   * 
   * @example
   * const cost = await MenuCostCalculator.calculateOrderItemCost(
   *   conn, 
   *   'pizza_id', 
   *   ['large_variation_id', 'pepperoni_variation_id']
   * );
   * // Returns: { totalCost: 5.50, baseCost: 3.00, sizeMultiplier: 1.5, ... }
   */
  static async calculateOrderItemCost(conn, menuItemId, selectedVariationIds = []) {
    try {
      // 1. Get menu item and validate it has a recipe
      const menuItem = await MenuItemRepo.getById(conn, menuItemId);
      if (!menuItem) {
        throw new AppError('Menu item not found', 404);
      }

      if (!menuItem.recipeId) {
        logger.warn('[MenuCostCalculator] Menu item has no recipe, cost = 0', {
          menuItemId,
          menuItemName: menuItem.name
        });
        return {
          totalCost: 0,
          baseCost: 0,
          sizeMultiplier: 1,
          additionalCost: 0,
          hasRecipe: false,
          breakdown: null
        };
      }

      // 2. Get base recipe cost
      const baseRecipe = await RecipeRepo.getById(conn, menuItem.recipeId);
      if (!baseRecipe) {
        throw new AppError('Recipe not found for menu item', 404);
      }

      let baseCost = baseRecipe.totalCost || 0;
      let sizeMultiplier = 1.0;
      let additionalCost = 0;
      const variationDetails = [];

      // 3. Process selected variations
      if (selectedVariationIds && selectedVariationIds.length > 0) {
        const variations = await MenuVariationRepo.model(conn)
          .find({ _id: { $in: selectedVariationIds } })
          .lean();

        for (const variation of variations) {
          const varDetail = {
            variationId: variation._id,
            name: variation.name,
            type: variation.type,
            cost: 0
          };

          // If variation is linked to recipe variant (preferred method)
          if (variation.recipeVariantId) {
            const recipeVariant = await RecipeVariantRepo.getById(conn, variation.recipeVariantId);
            
            if (recipeVariant) {
              if (variation.type === 'size') {
                // Size variations multiply the entire base cost
                sizeMultiplier = recipeVariant.sizeMultiplier || 1;
                varDetail.cost = baseCost * (sizeMultiplier - 1);
                varDetail.multiplier = sizeMultiplier;
              } else {
                // Flavor/addon variations add to the cost
                const variantCost = recipeVariant.totalCost || 0;
                additionalCost += variantCost;
                varDetail.cost = variantCost;
              }
            }
          } 
          // Legacy: calculate from ingredients array
          else if (variation.ingredients && variation.ingredients.length > 0) {
            let ingredientCost = 0;
            for (const ing of variation.ingredients) {
              ingredientCost += (ing.quantity || 0) * (ing.costPerUnit || 0);
            }
            additionalCost += ingredientCost;
            varDetail.cost = ingredientCost;
            varDetail.legacy = true;
          }
          // Fallback: use costDelta or calculatedCost
          else if (variation.calculatedCost) {
            additionalCost += variation.calculatedCost;
            varDetail.cost = variation.calculatedCost;
          } else if (variation.costDelta) {
            additionalCost += variation.costDelta;
            varDetail.cost = variation.costDelta;
          }

          variationDetails.push(varDetail);
        }
      }

      // 4. Calculate total cost
      // Formula: (baseCost + additionalCost) * sizeMultiplier
      // Note: Size multiplier affects both base and additional ingredients
      const totalCost = (baseCost + additionalCost) * sizeMultiplier;

      const result = {
        totalCost: Number(totalCost.toFixed(4)),
        baseCost: Number(baseCost.toFixed(4)),
        sizeMultiplier,
        additionalCost: Number(additionalCost.toFixed(4)),
        hasRecipe: true,
        breakdown: {
          baseRecipeCost: Number(baseCost.toFixed(4)),
          sizeAdjustment: Number((baseCost * (sizeMultiplier - 1)).toFixed(4)),
          additionsCost: Number((additionalCost * sizeMultiplier).toFixed(4)),
          variations: variationDetails
        }
      };

      logger.debug('[MenuCostCalculator] Cost calculated', {
        menuItemId,
        menuItemName: menuItem.name,
        variationCount: selectedVariationIds.length,
        totalCost: result.totalCost
      });

      return result;

    } catch (error) {
      logger.error('[MenuCostCalculator] Cost calculation failed', {
        error: error.message,
        menuItemId,
        selectedVariationIds,
        stack: error.stack
      });
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        `Failed to calculate menu item cost: ${error.message}`,
        500
      );
    }
  }

  /**
   * Calculate profit margin for a menu item with variations
   * 
   * @param {Object} conn - Tenant database connection
   * @param {String} menuItemId - Menu item ID
   * @param {Array<String>} selectedVariationIds - Array of selected variation IDs
   * @param {Number} sellingPrice - Final selling price to customer
   * @returns {Promise<Object>} Profit margin analysis
   */
  static async calculateProfitMargin(conn, menuItemId, selectedVariationIds, sellingPrice) {
    const costData = await this.calculateOrderItemCost(conn, menuItemId, selectedVariationIds);
    
    const profit = sellingPrice - costData.totalCost;
    const marginPercent = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;

    return {
      sellingPrice,
      cost: costData.totalCost,
      profit,
      marginPercent: Number(marginPercent.toFixed(2)),
      isProfit: profit > 0,
      costBreakdown: costData.breakdown
    };
  }

  /**
   * Batch calculate costs for multiple order items
   * 
   * @param {Object} conn - Tenant database connection
   * @param {Array<Object>} items - Array of { menuItemId, selectedVariationIds }
   * @returns {Promise<Array<Object>>} Array of cost calculations
   */
  static async batchCalculateCosts(conn, items) {
    const results = [];
    
    for (const item of items) {
      try {
        const cost = await this.calculateOrderItemCost(
          conn,
          item.menuItemId,
          item.selectedVariationIds || []
        );
        results.push({
          menuItemId: item.menuItemId,
          success: true,
          cost
        });
      } catch (error) {
        logger.error('[MenuCostCalculator] Batch calculation failed for item', {
          menuItemId: item.menuItemId,
          error: error.message
        });
        results.push({
          menuItemId: item.menuItemId,
          success: false,
          error: error.message,
          cost: { totalCost: 0 }
        });
      }
    }

    return results;
  }
}

module.exports = MenuCostCalculator;

