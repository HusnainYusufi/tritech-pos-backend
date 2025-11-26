const Joi = require('joi');

const features = Joi.object({
  staff: Joi.boolean(), customers: Joi.boolean(), menu: Joi.boolean(), orders: Joi.boolean(),
  analytics: Joi.boolean(), pos: Joi.boolean(), inventory: Joi.boolean(), branches: Joi.boolean(), recipes: Joi.boolean(),
});

const prices = Joi.object({
  monthly: Joi.number().min(0), quarterly: Joi.number().min(0), annual: Joi.number().min(0), currency: Joi.string().default('PKR')
});

const createPlan = Joi.object({
  name: Joi.string().required(),
  type: Joi.string().valid('trial','paid').required(),
  status: Joi.string().valid('active','inactive').optional(),
  prices: prices.optional(),
  features: features.optional(),
});

const updatePlan = Joi.object({
  name: Joi.string().optional(),
  type: Joi.string().valid('trial','paid').optional(),
  status: Joi.string().valid('active','inactive').optional(),
  prices: prices.optional(),
  features: features.optional(),
});

module.exports = { createPlan, updatePlan };
