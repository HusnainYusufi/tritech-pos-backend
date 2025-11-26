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
  name: Joi.string().max(160).required(),
  type: Joi.string().valid('size','crust','flavor','addon','combo','custom').default('custom'),
  priceDelta: Joi.number().default(0),
  costDelta: Joi.number().default(0),
  sizeMultiplier: Joi.number().min(0.01).default(1),
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
