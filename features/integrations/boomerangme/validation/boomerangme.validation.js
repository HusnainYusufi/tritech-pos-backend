'use strict';

const Joi = require('joi');

// ============================================================
// INBOUND ENDPOINTS (Boomerangme calls us)
// ============================================================

/**
 * Credential object schema (used by Boomerangme)
 */
const credentialSchema = Joi.object({
  name: Joi.string().max(100).required(),
  value: Joi.string().max(500).required()
});

/**
 * POST /check-credentials
 * Boomerangme sends credentials as an array
 */
const checkCredentials = Joi.alternatives().try(
  // Array of credentials (Boomerangme's format)
  Joi.array().items(credentialSchema).min(0),
  // Or wrapped in object
  Joi.object({
    credentials: Joi.array().items(credentialSchema).min(0).default([])
  })
);

/**
 * POST /get-inventory
 * Similar to check-credentials
 */
const getInventory = Joi.alternatives().try(
  Joi.array().items(credentialSchema).min(0),
  Joi.object({
    credentials: Joi.array().items(credentialSchema).min(0).default([])
  })
);

// ============================================================
// WEBHOOK ENDPOINTS
// ============================================================

/**
 * POST /webhook/order-completed
 */
const webhookOrderCompleted = Joi.object({
  orderId: Joi.string().required().messages({
    'any.required': 'orderId is required',
    'string.empty': 'orderId cannot be empty'
  }),
  customerPhone: Joi.string().max(20).allow('', null).optional(),
  customerEmail: Joi.string().email().allow('', null).optional(),
  webhookSecret: Joi.string().max(200).allow('', null).optional()
});

/**
 * POST /webhook/order-refunded
 */
const webhookOrderRefunded = Joi.object({
  orderId: Joi.string().required().messages({
    'any.required': 'orderId is required',
    'string.empty': 'orderId cannot be empty'
  }),
  transactionId: Joi.string().max(200).allow('', null).optional(),
  webhookSecret: Joi.string().max(200).allow('', null).optional()
});

// ============================================================
// ADMIN ENDPOINTS
// ============================================================

/**
 * PUT /config
 */
const updateConfig = Joi.object({
  isEnabled: Joi.boolean().optional(),
  appToken: Joi.string().max(500).allow('', null).optional(),
  credentials: Joi.array().items(credentialSchema).optional(),
  webhookSecret: Joi.string().max(200).allow('', null).optional(),
  apiBaseUrl: Joi.string().uri().max(500).optional(),
  metadata: Joi.object().optional()
});

module.exports = {
  checkCredentials,
  getInventory,
  webhookOrderCompleted,
  webhookOrderRefunded,
  updateConfig
};
