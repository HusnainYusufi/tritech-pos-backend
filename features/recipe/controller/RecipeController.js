'use strict';

const express = require('express');
const router = express.Router();
const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const svc = require('../services/recipe.service');
const recipeWithVariantsSvc = require('../services/recipeWithVariants.service');
const { createRecipe, updateRecipe } = require('../validation/recipe.validation');
const { createRecipeWithVariants } = require('../validation/recipeWithVariants.validation');

router.use(tenantContext);

/**
 * 🚀 NEW: Create recipe with multiple variants atomically
 * POST /t/recipes/with-variants
 * 
 * This is the production-grade endpoint for creating a recipe with all its
 * variations in a single atomic transaction. If any part fails, everything
 * rolls back.
 * 
 * @swagger
 * /t/recipes/with-variants:
 *   post:
 *     summary: Create recipe with variants (atomic)
 *     description: Creates a recipe and all its variants in a single transaction
 *     tags: [Recipes]
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, ingredients]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Margherita Pizza"
 *               ingredients:
 *                 type: array
 *                 items:
 *                   type: object
 *               variations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: "Large"
 *                     sizeMultiplier:
 *                       type: number
 *                       example: 2
 *     responses:
 *       201:
 *         description: Recipe and variants created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Recipe slug already exists
 */
router.post('/with-variants',
  checkPerms(['recipes.manage']),
  validate(createRecipeWithVariants),
  async (req, res, next) => {
    try {
      const r = await recipeWithVariantsSvc.createWithVariants(req.tenantDb, req.body);
      res.status(r.status).json(r);
    } catch (e) { 
      logger.error('[RecipeController] Create with variants failed', {
        error: e.message,
        tenant: req.tenantSlug,
        recipeName: req.body?.name
      });
      next(e); 
    }
  }
);

// Create (standard - recipe only)
router.post('/',
  checkPerms(['recipes.manage']),
  validate(createRecipe),
  async (req, res, next) => {
    try {
      const r = await svc.create(req.tenantDb, req.body);
      res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

// List
router.get('/',
  checkPerms(['recipes.read'], { any: true }),
  async (req, res, next) => {
    try {
      const r = await svc.list(req.tenantDb, req.query);
      res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * NEW: Get a recipe together with its variants (by slug)
 * GET /t/recipes/by-slug/:slug/with-variants?activeOnly=true&page=1&limit=50
 * IMPORTANT: This must come BEFORE /:id routes to avoid conflicts
 */
router.get('/by-slug/:slug/with-variants',
  checkPerms(['recipes.read'], { any: true }),
  async (req, res, next) => {
    try {
      const r = await svc.getWithVariantsBySlug(req.tenantDb, req.params.slug, req.query);
      res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * NEW: Get a recipe together with its variants (by ID)
 * GET /t/recipes/:id/with-variants?activeOnly=true&page=1&limit=50&sort=createdAt&order=desc
 * IMPORTANT: This must come BEFORE /:id route to avoid conflicts
 */
router.get('/:id/with-variants',
  checkPerms(['recipes.read'], { any: true }),
  async (req, res, next) => {
    try {
      const r = await svc.getWithVariantsById(req.tenantDb, req.params.id, req.query);
      res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

// Get one
router.get('/:id',
  checkPerms(['recipes.read'], { any: true }),
  async (req, res, next) => {
    try {
      const r = await svc.get(req.tenantDb, req.params.id);
      res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

// Update
router.put('/:id',
  checkPerms(['recipes.manage']),
  validate(updateRecipe),
  async (req, res, next) => {
    try {
      const r = await svc.update(req.tenantDb, req.params.id, req.body);
      res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

// Delete
router.delete('/:id',
  checkPerms(['recipes.manage']),
  async (req, res, next) => {
    try {
      const r = await svc.del(req.tenantDb, req.params.id);
      res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

module.exports = router;
