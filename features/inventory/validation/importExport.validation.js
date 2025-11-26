'use strict';

const Joi = require('joi');

const importOptions = Joi.object({
  autoCreateCategories: Joi.boolean().default(false),
  duplicatePolicy: Joi.string().valid('skip','update').default('skip') // how to handle existing NAMEs/SKUs
});

module.exports = { importOptions };
