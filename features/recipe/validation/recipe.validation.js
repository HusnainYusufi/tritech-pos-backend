'use strict';
const Joi = require('joi');

const ingredientSchema = Joi.object({
  sourceType: Joi.string().valid('inventory', 'recipe').required(),
  sourceId: Joi.string().required(),
  nameSnapshot: Joi.string().allow(''),
  quantity: Joi.number().positive().required(),
  unit: Joi.string().required(),
  costPerUnit: Joi.number().min(0).default(0),
  totalCost: Joi.number().min(0).default(0),
});

const createRecipe = Joi.object({
  name: Joi.string().max(160).required(),
  customName: Joi.string().allow(''),
  slug: Joi.string().optional(),
  code: Joi.string().allow(''),
  description: Joi.string().allow(''),
  type: Joi.string().valid('sub', 'final').default('final'),
  ingredients: Joi.array().items(ingredientSchema).min(1).required(),
  yield: Joi.number().positive().default(1),
  isActive: Joi.boolean().optional(),
  metadata: Joi.object().optional(),
});

const updateRecipe = createRecipe.fork(Object.keys(createRecipe.describe().keys),
  (s) => s.optional()
);

module.exports = { createRecipe, updateRecipe };
