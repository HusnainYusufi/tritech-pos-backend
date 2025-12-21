'use strict';

const express = require('express');
const router = express.Router();
const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const svc = require('../services/recipeVariant.service');
const { createVariant, updateVariant } = require('../validation/recipeVariant.validation');

router.use(tenantContext);

/**
 * @swagger
 * /t/recipe-variants:
 *   post:
 *     tags:
 *       - Recipe Variants
 *     summary: Create recipe variant
 *     description: |
 *       Create a variant of an existing recipe (e.g., Small, Medium, Large).
 *       Variants use size multipliers to scale ingredient quantities.
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
 *               - recipeId
 *               - name
 *               - sizeMultiplier
 *             properties:
 *               recipeId:
 *                 type: string
 *                 example: recipe_1234567890
 *               name:
 *                 type: string
 *                 example: Large
 *               sizeMultiplier:
 *                 type: number
 *                 example: 1.5
 *                 description: Multiplier for ingredient quantities (1.0 = base recipe)
 *               isActive:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Recipe variant created successfully
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
 *                 result:
 *                   type: object
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
  validate(createVariant),
  async (req, res, next) => {
    try { const r = await svc.create(req.tenantDb, req.body); res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/recipe-variants:
 *   get:
 *     tags:
 *       - Recipe Variants
 *     summary: Get all recipe variants
 *     description: Retrieve list of recipe variants with filtering
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: recipeId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by recipe
 *       - name: activeOnly
 *         in: query
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Show only active variants
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Recipe variants retrieved successfully
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
 *                     variants:
 *                       type: array
 *                       items:
 *                         type: object
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
    try { const r = await svc.list(req.tenantDb, req.query); res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/recipe-variants/{id}:
 *   get:
 *     tags:
 *       - Recipe Variants
 *     summary: Get recipe variant by ID
 *     description: Retrieve detailed information about a specific recipe variant
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Recipe variant ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Recipe variant retrieved successfully
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
    try { const r = await svc.get(req.tenantDb, req.params.id); res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/recipe-variants/{id}:
 *   put:
 *     tags:
 *       - Recipe Variants
 *     summary: Update recipe variant
 *     description: Update recipe variant details and multiplier
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Recipe variant ID
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
 *               sizeMultiplier:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Recipe variant updated successfully
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
  validate(updateVariant),
  async (req, res, next) => {
    try { const r = await svc.update(req.tenantDb, req.params.id, req.body); res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/recipe-variants/{id}:
 *   delete:
 *     tags:
 *       - Recipe Variants
 *     summary: Delete recipe variant
 *     description: Delete a recipe variant (soft delete)
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Recipe variant ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Recipe variant deleted successfully
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
    try { const r = await svc.del(req.tenantDb, req.params.id); res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

module.exports = router;
