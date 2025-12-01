// features/tenant-auth/validation/tenantAuth.validation.js
const Joi = require('joi');

const registerOwner = Joi.object({
  fullName: Joi.string().max(120).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
  roles: Joi.array().items(Joi.string()).optional(),
  branchIds: Joi.array().items(Joi.string()).optional()
});

const login = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  posId: Joi.string().allow('', null),
  defaultBranchId: Joi.string().allow('', null)
});

const money = Joi.number().min(0);

const loginPin = Joi.object({
  pin: Joi.string().pattern(/^[0-9]{4,8}$/).required().messages({
    'string.pattern.base': 'PIN must be 4-8 digits'
  }),
  branchId: Joi.string().allow('', null),
  posId: Joi.string().allow('', null),
  defaultBranchId: Joi.string().allow('', null),
  openingAmount: money.required(),
  cashCounts: Joi.object().unknown(true).optional(),
  notes: Joi.string().max(500).allow('', null)
});

const logoutPin = Joi.object({
  declaredClosingAmount: money.required(),
  systemClosingAmount: money.allow(null),
  cashCounts: Joi.object().unknown(true).optional(),
  notes: Joi.string().max(500).allow('', null),
  branchId: Joi.string().allow('', null),
  posId: Joi.string().allow('', null),
  tillSessionId: Joi.string().allow('', null)
});

const forgotPassword = Joi.object({
  email: Joi.string().email().required()
});

const resetPassword = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).max(128).required()
});

module.exports = { registerOwner, login, loginPin, logoutPin, forgotPassword, resetPassword };
