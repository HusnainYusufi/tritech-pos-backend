const Joi = require('joi');

const createCategory = Joi.object({
  name: Joi.string().max(120).required(),
  slug: Joi.string().lowercase().trim().pattern(/^[a-z0-9\-]+$/).optional(),
  code: Joi.string().max(24).allow(''),
  description: Joi.string().allow(''),
  parentId: Joi.string().allow('', null),
  isActive: Joi.boolean().optional(),
  displayOrder: Joi.number().integer().min(0).optional(),
  metadata: Joi.object().optional(),
});

const updateCategory = Joi.object({
  name: Joi.string().max(120),
  slug: Joi.string().lowercase().trim().pattern(/^[a-z0-9\-]+$/),
  code: Joi.string().max(24).allow(''),
  description: Joi.string().allow(''),
  parentId: Joi.string().allow('', null),
  isActive: Joi.boolean(),
  displayOrder: Joi.number().integer().min(0),
  metadata: Joi.object(),
});

module.exports = { createCategory, updateCategory };
