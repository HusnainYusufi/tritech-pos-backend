'use strict';
const Joi = require('joi');

const ingredientSchema = Joi.object({
  sourceType: Joi.string().valid('inventory', 'recipe').required(),
  sourceId: Joi.string().required(),
  nameSnapshot: Joi.string().allow(''),
  quantity: Joi.number().positive().required(),
  unit: Joi.string().allow(''),
  costPerUnit: Joi.number().min(0).default(0),
  totalCost: Joi.number().min(0).default(0),
});

// Accept BOTH a single recipeId (string) OR an array of recipeIds (strings)
const createVariant = Joi.object({
  recipeId: Joi.alternatives().try(
    Joi.string().length(24).hex(),
    Joi.array().items(Joi.string().length(24).hex()).min(1)
  ).required(),

  name: Joi.string().max(160).required(),
  description: Joi.string().allow(''),
  type: Joi.string().valid('size', 'flavor', 'crust', 'style', 'custom').default('custom'),
  sizeMultiplier: Joi.number().min(0.1).default(1),
  baseCostAdjustment: Joi.number().default(0),
  crustType: Joi.string().allow(''),

  ingredients: Joi.array().items(ingredientSchema).optional(),
  isActive: Joi.boolean().optional(),
  metadata: Joi.object().optional(),
});

// Keep update flexible
const updateVariant = createVariant.fork(
  Object.keys(createVariant.describe().keys),
  (s) => s.optional()
);

module.exports = { createVariant, updateVariant };
