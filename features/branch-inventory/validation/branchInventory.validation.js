'use strict';
const Joi = require('joi');

const createBranchInventoryItem = Joi.object({
  branchId: Joi.string().required(),
  itemId: Joi.string().required(),

  quantity: Joi.number().min(0).default(0),
  reorderPoint: Joi.number().integer().min(0).default(0),
  minStock: Joi.number().integer().min(0).default(0),
  maxStock: Joi.number().integer().min(0).default(0),

  costPerUnit: Joi.number().min(0).default(0),
  sellingPrice: Joi.number().min(0).default(0),

  isActive: Joi.boolean().default(true),
  metadata: Joi.object().optional(),
});

const updateBranchInventoryItem = createBranchInventoryItem.fork(
  Object.keys(createBranchInventoryItem.describe().keys),
  (s) => s.optional(),
);

module.exports = {
  createBranchInventoryItem,
  updateBranchInventoryItem,
};
