// features/pos/validation/posOrder.validation.js
'use strict';

const Joi = require('joi');

const orderItem = Joi.object({
  menuItemId: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
  notes: Joi.string().allow('', null).max(500).optional(),
});

const createOrder = Joi.object({
  branchId: Joi.string().optional(),
  posId: Joi.string().optional(),
  tillSessionId: Joi.string().optional(),
  customerName: Joi.string().allow('', null).max(120).optional(),
  notes: Joi.string().allow('', null).max(500).optional(),
  items: Joi.array().items(orderItem).min(1).required(),
});

module.exports = { createOrder };
