'use strict';
const Joi = require('joi');

const ingredientOverride = Joi.object({
  sourceType: Joi.string().valid('inventory','recipe').required(),
  sourceId: Joi.string().required(),
  nameSnapshot: Joi.string().allow(''),
  quantity: Joi.number().min(0).default(0),
  unit: Joi.string().allow('')
});

const createMenuVariation = Joi.object({
  menuItemId: Joi.string().required(),
  
  // ✅ NEW: Recipe variant link for proper cost calculation
  recipeVariantId: Joi.string().allow(null, '').optional(),
  
  name: Joi.string().max(160).required(),
  type: Joi.string().valid('size','crust','flavor','addon','combo','custom').default('custom'),
  
  // ✅ ENHANCED: Validate reasonable price delta range
  priceDelta: Joi.number().min(-1000).max(1000).default(0).messages({
    'number.min': 'Price delta cannot be less than -$1000',
    'number.max': 'Price delta cannot exceed $1000'
  }),
  
  costDelta: Joi.number().default(0), // deprecated, kept for backward compatibility
  sizeMultiplier: Joi.number().min(0.01).max(10).default(1).messages({
    'number.min': 'Size multiplier must be at least 0.01',
    'number.max': 'Size multiplier cannot exceed 10'
  }),
  crustType: Joi.string().allow(''),
  flavorTag: Joi.string().allow(''),
  ingredients: Joi.array().items(ingredientOverride).optional(),
  isDefault: Joi.boolean().optional(),
  isActive: Joi.boolean().optional(),
  displayOrder: Joi.number().integer().min(0).default(0),
  metadata: Joi.object().optional()
});

const updateMenuVariation = createMenuVariation.fork(
  Object.keys(createMenuVariation.describe().keys),
  (s) => s.optional()
);

module.exports = { createMenuVariation, updateMenuVariation };
