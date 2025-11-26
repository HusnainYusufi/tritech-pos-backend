'use strict';
const Joi = require('joi');

// Groups
const createGroup = Joi.object({
  categoryId: Joi.string().required(),
  name: Joi.string().max(120).required(),
  description: Joi.string().allow(''),
  isActive: Joi.boolean().optional(),
  displayOrder: Joi.number().integer().min(0).default(0),
  metadata: Joi.object().optional()
});

const updateGroup = createGroup.fork(Object.keys(createGroup.describe().keys),(s)=>s.optional());

// Items
const baseItem = {
  groupId: Joi.string().required(),
  categoryId: Joi.string().required(),
  sourceType: Joi.string().valid('inventory','recipe').required(),
  sourceId: Joi.string().required(),
  nameSnapshot: Joi.string().max(160).required(),
  price: Joi.number().min(0).default(0),
  unit: Joi.string().max(24).default('unit'),
  isRequired: Joi.boolean().default(false),
  isActive: Joi.boolean().default(true),
  displayOrder: Joi.number().integer().min(0).default(0),
  metadata: Joi.object().optional()
};

const createItem = Joi.object(baseItem);
const updateItem = createItem.fork(Object.keys(baseItem),(s)=>s.optional());

const bulkCreateItems = Joi.object({
  groupId: Joi.string().required(),
  categoryId: Joi.string().required(),
  items: Joi.array().items(
    Joi.object({
      sourceType: Joi.string().valid('inventory','recipe').required(),
      sourceId: Joi.string().required(),
      nameSnapshot: Joi.string().max(160).required(),
      price: Joi.number().min(0).default(0),
      unit: Joi.string().max(24).default('unit'),
      isRequired: Joi.boolean().default(false),
      isActive: Joi.boolean().default(true),
      displayOrder: Joi.number().integer().min(0).default(0),
      metadata: Joi.object().optional()
    })
  ).min(1).required()
});

module.exports = { createGroup, updateGroup, createItem, updateItem, bulkCreateItems };
