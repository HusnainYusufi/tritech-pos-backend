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
 *     tags:
 *       - Recipes
 *     summary: Create recipe with variants (atomic transaction)
 *     description: |
 *       ✅ **Production-Grade Endpoint** - Creates a recipe and all its variants in a single atomic transaction.
 *       
 *       **Key Features:**
 *       - All-or-nothing: If any variant fails, entire transaction rolls back
 *       - Automatic cost calculation for base recipe and all variants
 *       - Circular dependency detection
 *       - Unit consistency validation
 *       
 *       **Production URL:** https://api.tritechtechnologyllc.com
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
 *                 description: Recipe name
 *                 example: "Pizza Base"
 *                 maxLength: 160
 *               slug:
 *                 type: string
 *                 description: URL-friendly identifier (auto-generated if not provided)
 *                 example: "pizza-base"
 *               description:
 *                 type: string
 *                 description: Recipe description
 *                 example: "Base pizza recipe with dough, sauce, and cheese"
 *               type:
 *                 type: string
 *                 enum: [sub, final]
 *                 description: Recipe type (sub = used in other recipes, final = standalone)
 *                 default: final
 *               ingredients:
 *                 type: array
 *                 description: Base recipe ingredients
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - sourceType
 *                     - sourceId
 *                     - quantity
 *                     - unit
 *                   properties:
 *                     sourceType:
 *                       type: string
 *                       enum: [inventory, recipe]
 *                       example: inventory
 *                     sourceId:
 *                       type: string
 *                       description: Inventory item ID or sub-recipe ID
 *                       example: "507f1f77bcf86cd799439011"
 *                     quantity:
 *                       type: number
 *                       minimum: 0
 *                       example: 200
 *                     unit:
 *                       type: string
 *                       example: "g"
 *               variations:
 *                 type: array
 *                 description: Recipe variants (sizes, flavors, etc.)
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                   properties:
 *                     name:
 *                       type: string
 *                       description: Variant name (must be unique per recipe)
 *                       example: "Large"
 *                       maxLength: 160
 *                     type:
 *                       type: string
 *                       enum: [size, flavor, crust, style, custom]
 *                       default: custom
 *                       example: size
 *                     sizeMultiplier:
 *                       type: number
 *                       description: Ingredient quantity multiplier (for size variations)
 *                       minimum: 0.01
 *                       maximum: 10
 *                       example: 1.5
 *                     baseCostAdjustment:
 *                       type: number
 *                       description: Fixed cost adjustment (+/-)
 *                       example: 0
 *                     ingredients:
 *                       type: array
 *                       description: Additional ingredients for this variant
 *                       items:
 *                         type: object
 *                         properties:
 *                           sourceType:
 *                             type: string
 *                             enum: [inventory, recipe]
 *                           sourceId:
 *                             type: string
 *                           quantity:
 *                             type: number
 *                           unit:
 *                             type: string
 *                     description:
 *                       type: string
 *                       example: "Large size (14 inch)"
 *                     isActive:
 *                       type: boolean
 *                       default: true
 *           examples:
 *             pizzaWithSizes:
 *               summary: Pizza with size variations
 *               value:
 *                 name: "Pizza Base"
 *                 ingredients:
 *                   - sourceType: "inventory"
 *                     sourceId: "dough_id"
 *                     quantity: 200
 *                     unit: "g"
 *                   - sourceType: "inventory"
 *                     sourceId: "cheese_id"
 *                     quantity: 100
 *                     unit: "g"
 *                 variations:
 *                   - name: "Small"
 *                     type: "size"
 *                     sizeMultiplier: 0.75
 *                   - name: "Medium"
 *                     type: "size"
 *                     sizeMultiplier: 1.0
 *                   - name: "Large"
 *                     type: "size"
 *                     sizeMultiplier: 1.5
 *     responses:
 *       201:
 *         description: Recipe and variants created successfully in single transaction
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
 *                   example: "Recipe created successfully with 3 variant(s)"
 *                 result:
 *                   type: object
 *                   properties:
 *                     recipe:
 *                       $ref: '#/components/schemas/Recipe'
 *                     variants:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           recipeId:
 *                             type: string
 *                           name:
 *                             type: string
 *                           type:
 *                             type: string
 *                           sizeMultiplier:
 *                             type: number
 *                           totalCost:
 *                             type: number
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         description: Recipe slug already exists
 *       500:
 *         $ref: '#/components/responses/ServerError'
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
