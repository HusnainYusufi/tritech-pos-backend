// features/pos/validation/posTerminal.validation.js
const Joi = require('joi');

const baseMetadata = Joi.object().unknown(true);

const createTerminal = Joi.object({
  branchId: Joi.string().required(),
  machineId: Joi.string().trim().required(),
  name: Joi.string().trim().max(120).required(),
  status: Joi.string().valid('active', 'maintenance', 'retired').default('active'),
  metadata: baseMetadata.allow(null)
});

const listTerminals = Joi.object({
  branchId: Joi.string().optional(),
  status: Joi.string().valid('active', 'maintenance', 'retired').optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(200).optional()
});

const updateTerminal = Joi.object({
  name: Joi.string().trim().max(120).optional(),
  status: Joi.string().valid('active', 'maintenance', 'retired').optional(),
  metadata: baseMetadata.allow(null).optional(),
  lastSeenAt: Joi.date().optional()
}).min(1);

module.exports = { createTerminal, listTerminals, updateTerminal };
