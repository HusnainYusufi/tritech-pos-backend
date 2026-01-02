// features/recipe/validation/recipeWithVariants.validation.js
'use strict';

const Joi = require('joi');

// Ingredient schema (used in both recipe and variants)
const ingredientSchema = Joi.object({
  sourceType: Joi.string().valid('inventory', 'recipe').required()
    .messages({
      'any.required': 'Ingredient sourceType is required',
      'any.only': 'Ingredient sourceType must be either "inventory" or "recipe"'
    }),
  sourceId: Joi.string().required()
    .messages({
      'any.required': 'Ingredient sourceId is required',
      'string.empty': 'Ingredient sourceId cannot be empty'
    }),
  nameSnapshot: Joi.string().allow('').optional(),
  quantity: Joi.number().positive().required()
    .messages({
      'any.required': 'Ingredient quantity is required',
      'number.positive': 'Ingredient quantity must be a positive number'
    }),
  unit: Joi.string().required()
    .messages({
      'any.required': 'Ingredient unit is required',
      'string.empty': 'Ingredient unit cannot be empty'
    }),
  costPerUnit: Joi.number().min(0).optional().default(0),
  totalCost: Joi.number().min(0).optional().default(0),
});

// Variant schema
const variantSchema = Joi.object({
  name: Joi.string().trim().min(1).max(160).required()
    .messages({
      'any.required': 'Variant name is required',
      'string.empty': 'Variant name cannot be empty',
      'string.min': 'Variant name must be at least 1 character',
      'string.max': 'Variant name cannot exceed 160 characters'
    }),
  description: Joi.string().allow('').optional().default(''),
  type: Joi.string().valid('size', 'flavor', 'crust', 'style', 'custom').optional().default('custom')
    .messages({
      'any.only': 'Variant type must be one of: size, flavor, crust, style, custom'
    }),
  sizeMultiplier: Joi.number().positive().optional().default(1)
    .messages({
      'number.positive': 'Size multiplier must be a positive number'
    }),
  baseCostAdjustment: Joi.number().optional().default(0)
    .messages({
      'number.base': 'Base cost adjustment must be a number'
    }),
  crustType: Joi.string().allow('').optional().default(''),
  ingredients: Joi.array().items(ingredientSchema).optional().default([])
    .messages({
      'array.base': 'Variant ingredients must be an array'
    }),
  isActive: Joi.boolean().optional().default(true),
  metadata: Joi.object().optional().default({}),
});

// Variant schema for updates (allows _id to upsert)
const variantUpdateSchema = variantSchema.keys({
  _id: Joi.string().optional()
});

// Main schema for creating recipe with variants
const createRecipeWithVariants = Joi.object({
  // Base recipe fields
  name: Joi.string().trim().min(1).max(160).required()
    .messages({
      'any.required': 'Recipe name is required',
      'string.empty': 'Recipe name cannot be empty',
      'string.min': 'Recipe name must be at least 1 character',
      'string.max': 'Recipe name cannot exceed 160 characters'
    }),
  customName: Joi.string().allow('').optional().default(''),
  slug: Joi.string().trim().lowercase().optional()
    .pattern(/^[a-z0-9-]+$/)
    .messages({
      'string.pattern.base': 'Slug can only contain lowercase letters, numbers, and hyphens'
    }),
  code: Joi.string().allow('').optional().default(''),
  description: Joi.string().allow('').optional().default(''),
  type: Joi.string().valid('sub', 'final').optional().default('final')
    .messages({
      'any.only': 'Recipe type must be either "sub" or "final"'
    }),
  ingredients: Joi.array().items(ingredientSchema).min(1).required()
    .messages({
      'any.required': 'Recipe ingredients are required',
      'array.min': 'Recipe must have at least one ingredient',
      'array.base': 'Ingredients must be an array'
    }),
  yield: Joi.number().positive().optional().default(1)
    .messages({
      'number.positive': 'Yield must be a positive number'
    }),
  isActive: Joi.boolean().optional().default(true),
  metadata: Joi.object().optional().default({}),

  // Variations array
  variations: Joi.array().items(variantSchema).optional().default([])
    .max(100)
    .messages({
      'array.base': 'Variations must be an array',
      'array.max': 'Cannot create more than 100 variations at once'
    }),
});

// Schema for updating recipe with variants
const updateRecipeWithVariants = Joi.object({
  // Base recipe fields
  name: Joi.string().trim().min(1).max(160).required()
    .messages({
      'any.required': 'Recipe name is required',
      'string.empty': 'Recipe name cannot be empty',
      'string.min': 'Recipe name must be at least 1 character',
      'string.max': 'Recipe name cannot exceed 160 characters'
    }),
  customName: Joi.string().allow('').optional().default(''),
  slug: Joi.string().trim().lowercase().optional()
    .pattern(/^[a-z0-9-]+$/)
    .messages({
      'string.pattern.base': 'Slug can only contain lowercase letters, numbers, and hyphens'
    }),
  code: Joi.string().allow('').optional().default(''),
  description: Joi.string().allow('').optional().default(''),
  type: Joi.string().valid('sub', 'final').optional().default('final')
    .messages({
      'any.only': 'Recipe type must be either "sub" or "final"'
    }),
  ingredients: Joi.array().items(ingredientSchema).min(1).required()
    .messages({
      'any.required': 'Recipe ingredients are required',
      'array.min': 'Recipe must have at least one ingredient',
      'array.base': 'Ingredients must be an array'
    }),
  yield: Joi.number().positive().optional().default(1)
    .messages({
      'number.positive': 'Yield must be a positive number'
    }),
  isActive: Joi.boolean().optional().default(true),
  metadata: Joi.object().optional().default({}),

  // Variations array
  variations: Joi.array().items(variantUpdateSchema).optional().default([])
    .max(100)
    .messages({
      'array.base': 'Variations must be an array',
      'array.max': 'Cannot update more than 100 variations at once'
    }),
});

module.exports = {
  createRecipeWithVariants,
  updateRecipeWithVariants,
  ingredientSchema,
  variantSchema,
  variantUpdateSchema
};

