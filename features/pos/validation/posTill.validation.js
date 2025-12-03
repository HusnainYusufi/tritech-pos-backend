// features/pos/validation/posTill.validation.js
const Joi = require('joi');

const money = Joi.number().min(0);

const openTill = Joi.object({
  branchId: Joi.string().required(),
  posId: Joi.string().required(),
  openingAmount: money.required(),
  cashCounts: Joi.object().unknown(true).optional(),
  notes: Joi.string().max(500).allow('', null)
});

const closeTill = Joi.object({
  declaredClosingAmount: money.required(),
  systemClosingAmount: money.allow(null),
  cashCounts: Joi.object().unknown(true).optional(),
  notes: Joi.string().max(500).allow('', null),
  branchId: Joi.string().required(),
  posId: Joi.string().required(),
  tillSessionId: Joi.string().allow('', null)
});

module.exports = { openTill, closeTill };
