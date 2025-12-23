// features/pos/validation/posOrder.validation.js
'use strict';

const Joi = require('joi');

const orderItem = Joi.object({
  menuItemId: Joi.string().required()
    .messages({
      'any.required': 'Menu item ID is required',
      'string.empty': 'Menu item ID cannot be empty'
    }),
  
  // ✅ NEW: Support for menu variations (size, flavors, add-ons)
  variations: Joi.array().items(Joi.string()).optional()
    .messages({
      'array.base': 'Variations must be an array of variation IDs'
    }),
  
  quantity: Joi.number().integer().min(1).required()
    .messages({
      'any.required': 'Quantity is required',
      'number.min': 'Quantity must be at least 1',
      'number.integer': 'Quantity must be a whole number'
    }),
  notes: Joi.string().allow('', null).max(500).optional(),
});

const createOrder = Joi.object({
  branchId: Joi.string().optional(),
  posId: Joi.string().optional(),
  tillSessionId: Joi.string().optional(),
  customerName: Joi.string().allow('', null).max(120).optional(),
  customerPhone: Joi.string().allow('', null).max(20).optional(),
  notes: Joi.string().allow('', null).max(500).optional(),
  items: Joi.array().items(orderItem).min(1).required()
    .messages({
      'any.required': 'Order items are required',
      'array.min': 'Order must have at least one item'
    }),
  paymentMethod: Joi.string().valid('cash', 'card', 'mobile', 'split').optional().default('cash')
    .messages({
      'any.only': 'Payment method must be one of: cash, card, mobile, split'
    }),
  amountPaid: Joi.number().min(0).optional().default(0)
    .messages({
      'number.min': 'Amount paid cannot be negative'
    }),
});

module.exports = { createOrder };
