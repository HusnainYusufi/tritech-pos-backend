// features/pos/validation/posMenu.validation.js
'use strict';

const Joi = require('joi');

const getPosMenu = Joi.object({
  branchId: Joi.string().optional(),
  categoryId: Joi.string().optional(),
  q: Joi.string().optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(500).optional(),
  includeUnavailable: Joi.boolean().optional(),
  includeHidden: Joi.boolean().optional(),
});

module.exports = { getPosMenu };
