'use strict';
const express = require('express');
const router = express.Router();

const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const svc = require('../services/menuVariation.service');
const { createMenuVariation, updateMenuVariation } = require('../validation/menuVariation.validation');

router.use(tenantContext);

/**
 * @swagger
 * /t/menu/variations:
 *   post:
 *     tags:
 *       - Menu Variations
 *     summary: Create menu variation
 *     description: Create a new menu variation (size, add-ons, etc.)
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
 *               - menuItemId
 *               - name
 *               - priceAdjustment
 *             properties:
 *               menuItemId:
 *                 type: string
 *                 example: item_1234567890
 *               name:
 *                 type: string
 *                 example: Large
 *               priceAdjustment:
 *                 type: number
 *                 example: 3.00
 *               description:
 *                 type: string
 *                 example: Large size (14 inch)
 *     responses:
 *       201:
 *         description: Variation created successfully
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
  checkPerms(['menu.variations.manage']),
  validate(createMenuVariation),
  async (req, res, next) => {
    try { const r = await svc.create(req.tenantDb, req.body); res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/menu/variations:
 *   get:
 *     tags:
 *       - Menu Variations
 *     summary: Get all menu variations
 *     description: Retrieve list of all menu variations
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Variations retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/',
  checkPerms(['menu.variations.read'], { any: true }),
  async (req, res, next) => {
    try { const r = await svc.list(req.tenantDb, req.query); res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/menu/variations/by-item/{menuItemId}:
 *   get:
 *     tags:
 *       - Menu Variations
 *     summary: Get variations by menu item
 *     description: Retrieve all variations for a specific menu item
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: menuItemId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Menu Item ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Variations retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/by-item/:menuItemId',
  checkPerms(['menu.variations.read'], { any: true }),
  async (req, res, next) => {
    try { const r = await svc.listByMenuItem(req.tenantDb, req.params.menuItemId, req.query); res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/menu/variations/{id}:
 *   get:
 *     tags:
 *       - Menu Variations
 *     summary: Get variation by ID
 *     description: Retrieve a specific menu variation
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Variation retrieved successfully
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
  checkPerms(['menu.variations.read'], { any: true }),
  async (req, res, next) => {
    try { const r = await svc.get(req.tenantDb, req.params.id); res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/menu/variations/{id}:
 *   put:
 *     tags:
 *       - Menu Variations
 *     summary: Update variation
 *     description: Update menu variation details
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
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
 *               priceAdjustment:
 *                 type: number
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Variation updated successfully
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
  checkPerms(['menu.variations.manage']),
  validate(updateMenuVariation),
  async (req, res, next) => {
    try { const r = await svc.update(req.tenantDb, req.params.id, req.body); res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/menu/variations/{id}:
 *   delete:
 *     tags:
 *       - Menu Variations
 *     summary: Delete variation
 *     description: Delete a menu variation
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Variation deleted successfully
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
  checkPerms(['menu.variations.manage']),
  async (req, res, next) => {
    try { const r = await svc.del(req.tenantDb, req.params.id); res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

module.exports = router;
