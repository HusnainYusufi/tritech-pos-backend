const Joi = require('joi');
const mongoose = require('mongoose');

const createItem = Joi.object({
  name: Joi.string().max(160).required(),
  sku: Joi.string().max(64).optional(), // if absent, auto-generated
  type: Joi.string().valid('stock', 'nonstock', 'service').optional(),
  isActive: Joi.boolean().optional(),

  categoryId: Joi.string().allow('', null).custom((value, helpers) => {
    // If categoryId is provided (not empty/null), validate ObjectId format
    if (value && value !== '' && !mongoose.Types.ObjectId.isValid(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  }, 'ObjectId validation').messages({
    'any.invalid': 'categoryId must be a valid MongoDB ObjectId'
  }),

  baseUnit: Joi.string().allow(''),
  purchaseUnit: Joi.string().allow(''),
  conversion: Joi.number().min(0.000001).default(1),

  reorderPoint: Joi.number().integer().min(0).default(0),
  quantity: Joi.number().min(0).default(0),
  branches: Joi.array().items(Joi.string()).optional(),
  notes: Joi.string().allow(''),
  metadata: Joi.object().optional(),
});

const updateItem = createItem.fork(
  Object.keys(createItem.describe().keys),
  (s) => s.optional()
);

module.exports = { createItem, updateItem };
