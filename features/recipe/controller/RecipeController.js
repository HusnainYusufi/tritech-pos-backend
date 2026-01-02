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
const { createRecipeWithVariants, updateRecipeWithVariants } = require('../validation/recipeWithVariants.validation');

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

/**
 * 🔄 Update recipe with variants atomically
 * PUT /t/recipes/with-variants/:id
 *
 * Upserts variants by _id; removes variants not present in the payload.
 */
router.put('/with-variants/:id',
  checkPerms(['recipes.manage']),
  validate(updateRecipeWithVariants),
  async (req, res, next) => {
    try {
      const r = await recipeWithVariantsSvc.updateWithVariants(req.tenantDb, req.params.id, req.body);
      res.status(r.status).json(r);
    } catch (e) {
      logger.error('[RecipeController] Update with variants failed', {
        error: e.message,
        tenant: req.tenantSlug,
        recipeId: req.params?.id,
        recipeName: req.body?.name
      });
      next(e);
    }
  }
);

/**
 * @swagger
 * /t/recipes:
 *   post:
 *     tags:
 *       - Recipes
 *     summary: Create recipe (standard)
 *     description: Create a recipe without variations. Use /with-variants for atomic creation with variations.
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - ingredients
 *             properties:
 *               name:
 *                 type: string
 *                 example: Margherita Pizza
 *               description:
 *                 type: string
 *                 example: Classic Italian pizza
 *               ingredients:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - inventoryItemId
 *                     - quantity
 *                     - unit
 *                   properties:
 *                     inventoryItemId:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                       example: 200
 *                     unit:
 *                       type: string
 *                       example: g
 *               preparationTime:
 *                 type: number
 *                 example: 15
 *               cookingTime:
 *                 type: number
 *                 example: 12
 *     responses:
 *       201:
 *         description: Recipe created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 201
 *                 message:
 *                   type: string
 *                   example: Recipe created successfully
 *                 result:
 *                   $ref: '#/components/schemas/Recipe'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
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

/**
 * @swagger
 * /t/recipes:
 *   get:
 *     tags:
 *       - Recipes
 *     summary: Get all recipes
 *     description: Retrieve list of recipes with filtering and pagination
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *         description: Search by name or description
 *       - name: sort
 *         in: query
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Sort field
 *       - name: order
 *         in: query
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Recipes retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: OK
 *                 result:
 *                   type: object
 *                   properties:
 *                     recipes:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Recipe'
 *                     pagination:
 *                       type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
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
 * @swagger
 * /t/recipes/by-slug/{slug}/with-variants:
 *   get:
 *     tags:
 *       - Recipes
 *     summary: Get recipe with variants by slug
 *     description: Retrieve a recipe and all its variations using slug identifier
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: slug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Recipe slug
 *       - name: activeOnly
 *         in: query
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Show only active variations
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Recipe with variants retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                 result:
 *                   type: object
 *                   properties:
 *                     recipe:
 *                       $ref: '#/components/schemas/Recipe'
 *                     variations:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
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
 * @swagger
 * /t/recipes/{id}/with-variants:
 *   get:
 *     tags:
 *       - Recipes
 *     summary: Get recipe with variants by ID
 *     description: Retrieve a recipe and all its variations using ID
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Recipe ID
 *       - name: activeOnly
 *         in: query
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Show only active variations
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - name: sort
 *         in: query
 *         schema:
 *           type: string
 *           default: createdAt
 *       - name: order
 *         in: query
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Recipe with variants retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                 result:
 *                   type: object
 *                   properties:
 *                     recipe:
 *                       $ref: '#/components/schemas/Recipe'
 *                     variations:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
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

/**
 * @swagger
 * /t/recipes/{id}:
 *   get:
 *     tags:
 *       - Recipes
 *     summary: Get recipe by ID
 *     description: Retrieve detailed information about a specific recipe
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Recipe ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Recipe retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                 result:
 *                   $ref: '#/components/schemas/Recipe'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:id',
  checkPerms(['recipes.read'], { any: true }),
  async (req, res, next) => {
    try {
      const r = await svc.get(req.tenantDb, req.params.id);
      res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/recipes/{id}:
 *   put:
 *     tags:
 *       - Recipes
 *     summary: Update recipe
 *     description: Update recipe details and ingredients
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Recipe ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               ingredients:
 *                 type: array
 *                 items:
 *                   type: object
 *               preparationTime:
 *                 type: number
 *               cookingTime:
 *                 type: number
 *     responses:
 *       200:
 *         description: Recipe updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                 result:
 *                   $ref: '#/components/schemas/Recipe'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
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

/**
 * @swagger
 * /t/recipes/{id}:
 *   delete:
 *     tags:
 *       - Recipes
 *     summary: Delete recipe
 *     description: Delete a recipe (soft delete)
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Recipe ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Recipe deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
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
