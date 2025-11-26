'use strict';
const Joi = require('joi');

const createMenuCategory = Joi.object({
  name: Joi.string().max(160).required(),
  slug: Joi.string().optional(),
  code: Joi.string().allow(''),
  description: Joi.string().allow(''),
  parentId: Joi.string().allow('', null),
  isActive: Joi.boolean().optional(),
  displayOrder: Joi.number().integer().min(0).default(0),
  metadata: Joi.object().optional()
});

const updateMenuCategory = createMenuCategory.fork(
  Object.keys(createMenuCategory.describe().keys),
  (s) => s.optional()
);

module.exports = { createMenuCategory, updateMenuCategory };
