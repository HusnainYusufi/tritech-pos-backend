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

const forgotPassword = Joi.object({
  email: Joi.string().email().required()
});

const resetPassword = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).max(128).required()
});

module.exports = { registerOwner, login, forgotPassword, resetPassword };
