const Joi = require('joi');

const createTenant = Joi.object({
  name: Joi.string().max(120).required(),
  slug: Joi.string().lowercase().trim().pattern(/^[a-z0-9-]+$/).required(),
  contactEmail: Joi.string().email().required(),
  contactPhone: Joi.string().optional(),
  website: Joi.string().uri().optional(),
  address: Joi.object({
    country: Joi.string().allow(''),
    city: Joi.string().allow(''),
    line: Joi.string().allow(''),
  }).optional(),
  branches: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    code: Joi.string().required(),
  })).optional(),
  planId: Joi.string().optional(),
  status: Joi.string().valid('paid', 'unpaid', 'suspended', 'trial').optional(),
});
const updateTenant = Joi.object({
  name: Joi.string().max(120).optional(),
  status: Joi.string().valid('paid','unpaid','suspended','trial').optional(),
  planId: Joi.string().allow(null, '').optional(),
  contactEmail: Joi.string().email().allow('').optional(),
  contactPhone: Joi.string().allow('').optional(),
  website: Joi.string().uri().allow('').optional(),
  address: Joi.object({ country: Joi.string().allow(''), city: Joi.string().allow(''), line: Joi.string().allow('') }).optional(),
  locationsCount: Joi.number().integer().min(0).optional(),
});

module.exports = { createTenant, updateTenant };
