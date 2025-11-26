// features/staff/validation/staff.validation.js
'use strict';

const Joi = require('joi');

const pinSchema = Joi.string().pattern(/^[0-9]{4,8}$/).messages({
  'string.pattern.base': 'PIN must be 4-8 digits',
});

const roleGrantSchema = Joi.object({
  roleKey: Joi.string().required(),
  scope: Joi.string().valid('tenant', 'branch').default('tenant'),
  branchId: Joi.when('scope', { is: 'branch', then: Joi.string().required(), otherwise: Joi.forbidden() })
});

const createStaff = Joi.object({
  fullName: Joi.string().max(120).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).optional(),
  branchIds: Joi.array().items(Joi.string()).min(1).required(),
  roles: Joi.array().items(Joi.string()).optional(),
  roleGrants: Joi.array().items(roleGrantSchema).optional(),
  pin: pinSchema.optional(),
  position: Joi.string().max(120).optional(),
  metadata: Joi.object().optional(),
  branchId: Joi.string().optional() // branch context for branch-scoped managers
});

const updateStaff = Joi.object({
  fullName: Joi.string().max(120).optional(),
  email: Joi.string().email().optional(),
  password: Joi.string().min(8).max(128).optional(),
  branchIds: Joi.array().items(Joi.string()).min(1).optional(),
  roles: Joi.array().items(Joi.string()).optional(),
  roleGrants: Joi.array().items(roleGrantSchema).optional(),
  position: Joi.string().max(120).optional(),
  metadata: Joi.object().optional(),
  branchId: Joi.string().optional()
});

const listStaff = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20),
  status: Joi.string().valid('active', 'suspended').optional(),
  branchId: Joi.string().optional(),
  q: Joi.string().allow('').optional()
});

const updatePin = Joi.object({
  pin: pinSchema.required(),
  branchId: Joi.string().optional()
});

const updateStatus = Joi.object({
  status: Joi.string().valid('active', 'suspended').required(),
  branchId: Joi.string().optional()
});

module.exports = { createStaff, updateStaff, listStaff, updatePin, updateStatus };
