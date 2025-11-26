// features/branch-menu/validation/branchMenu.validation.js
'use strict';

const Joi = require('joi');

const createBranchMenuConfig = Joi.object({
  branchId: Joi.string().required(),
  menuItemId: Joi.string().required(),

  isAvailable: Joi.boolean().optional(),
  isVisibleInPOS: Joi.boolean().optional(),
  isVisibleInOnline: Joi.boolean().optional(),

  sellingPrice: Joi.number().min(0).allow(null).optional(),
  priceIncludesTax: Joi.boolean().optional(),

  displayOrder: Joi.number().integer().min(0).optional(),

  isFeatured: Joi.boolean().optional(),
  isRecommended: Joi.boolean().optional(),

  labels: Joi.array().items(Joi.string().trim()).optional(),

  metadata: Joi.object().optional(),
});

const updateBranchMenuConfig = Joi.object({
  id: Joi.string().required(),

  branchId: Joi.string().optional(), // optional here; id is primary key
  isAvailable: Joi.boolean().optional(),
  isVisibleInPOS: Joi.boolean().optional(),
  isVisibleInOnline: Joi.boolean().optional(),

  sellingPrice: Joi.number().min(0).allow(null).optional(),
  priceIncludesTax: Joi.boolean().optional(),

  displayOrder: Joi.number().integer().min(0).optional(),

  isFeatured: Joi.boolean().optional(),
  isRecommended: Joi.boolean().optional(),

  labels: Joi.array().items(Joi.string().trim()).optional(),

  metadata: Joi.object().optional(),
});

const listBranchMenuConfig = Joi.object({
  branchId: Joi.string().optional(),
  categoryId: Joi.string().optional(),
  q: Joi.string().optional(),
  onlyAvailable: Joi.boolean().optional(),
  isVisibleInPOS: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(500).optional(),
});

const listEffectiveBranchMenu = Joi.object({
  branchId: Joi.string().required(),
  categoryId: Joi.string().optional(),
  q: Joi.string().optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(500).optional(),
});

module.exports = {
  createBranchMenuConfig,
  updateBranchMenuConfig,
  listBranchMenuConfig,
  listEffectiveBranchMenu,
};
