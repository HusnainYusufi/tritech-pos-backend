// features/branch/validation/branch.validation.js
const Joi = require('joi');

const createBranch = Joi.object({
  name: Joi.string().max(160).required(),
  code: Joi.string().lowercase().regex(/^[a-z0-9\-]+$/).required(),
  status: Joi.string().valid('active','inactive','archived').optional(),
  isDefault: Joi.boolean().optional(),
  contact: Joi.object({ phone: Joi.string().allow(''), email: Joi.string().email().allow('') }).optional(),
  address: Joi.object({
    line1: Joi.string().allow(''),
    line2: Joi.string().allow(''),
    city: Joi.string().allow(''),
    state: Joi.string().allow(''),
    postalCode: Joi.string().allow(''),
    country: Joi.string().allow('')
  }).optional(),
  timezone: Joi.string().optional(),
  currency: Joi.string().optional(),
  tax: Joi.object({
    mode: Joi.string().valid('inclusive','exclusive'),
    rate: Joi.number().min(0).max(99.99),
    vatNumber: Joi.string().allow('')
  }).optional(),
  posConfig: Joi.object({
    orderPrefix: Joi.string().allow(''),
    receiptFooter: Joi.string().allow(''),
    enableHoldOrders: Joi.boolean(),
    enableTableService: Joi.boolean()
  }).optional(),
  printers: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    type: Joi.string().valid('network','usb','bluetooth').default('network'),
    ip: Joi.string().allow(''),
    port: Joi.number().default(9100),
    target: Joi.string().valid('kitchen','receipt','bar','label').default('receipt'),
    enabled: Joi.boolean().default(true)
  })).optional(),
  metadata: Joi.object().optional()
});

const updateBranch = createBranch.fork(
  Object.keys(createBranch.describe().keys),
  (schema) => schema.optional()
);

const updateSettings = Joi.object({
  timezone: Joi.string().optional(),
  currency: Joi.string().optional(),
  tax: Joi.object({
    mode: Joi.string().valid('inclusive','exclusive'),
    rate: Joi.number().min(0).max(99.99),
    vatNumber: Joi.string().allow('')
  }).optional(),
  posConfig: Joi.object({
    orderPrefix: Joi.string().allow(''),
    receiptFooter: Joi.string().allow(''),
    enableHoldOrders: Joi.boolean(),
    enableTableService: Joi.boolean()
  }).optional(),
  printers: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    type: Joi.string().valid('network','usb','bluetooth').default('network'),
    ip: Joi.string().allow(''),
    port: Joi.number().default(9100),
    target: Joi.string().valid('kitchen','receipt','bar','label').default('receipt'),
    enabled: Joi.boolean().default(true)
  })).optional()
});

const branchUser = Joi.object({
  userId: Joi.string().required()
});

module.exports = { createBranch, updateBranch, updateSettings, branchUser };
