'use strict';
const Joi = require('joi');

const pricingSchema = Joi.object({
  basePrice: Joi.number().min(0).default(0),
  priceIncludesTax: Joi.boolean().default(false),
  currency: Joi.string().max(8).default('SAR')
});

const createMenuItem = Joi.object({
  name: Joi.string().max(160).required(),
  slug: Joi.string().optional(),
  code: Joi.string().allow(''),
  description: Joi.string().allow(''),
  categoryId: Joi.string().allow('', null),
  recipeId: Joi.string().allow('', null),
  pricing: pricingSchema.optional(),
  isActive: Joi.boolean().optional(),
  displayOrder: Joi.number().integer().min(0).default(0),
  tags: Joi.array().items(Joi.string()).optional(),
  media: Joi.array().items(Joi.object({ url: Joi.string().uri().required(), alt: Joi.string().allow(''), type: Joi.string().valid('image','video').default('image') })).optional(),
  branchIds: Joi.array().items(Joi.string()).optional(),
  metadata: Joi.object().optional()
});

const updateMenuItem = createMenuItem.fork(
  Object.keys(createMenuItem.describe().keys),
  (s) => s.optional()
);

module.exports = { createMenuItem, updateMenuItem };
