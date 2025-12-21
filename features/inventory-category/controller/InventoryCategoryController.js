'use strict';
const express = require('express');
const router = express.Router();

const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const svc = require('../services/inventoryCategory.service');
const { createCategory, updateCategory } = require('../validation/inventoryCategory.validation');
const ItemRepo = require('../../inventory/repository/inventoryItem.repository');

router.use(tenantContext);

/**
 * @swagger
 * /t/inventory/categories:
 *   post:
 *     tags:
 *       - Inventory Categories
 *     summary: Create inventory category
 *     description: Create a new inventory category for organizing inventory items
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
 *             properties:
 *               name:
 *                 type: string
 *                 example: Vegetables
 *               description:
 *                 type: string
 *                 example: Fresh vegetables and produce
 *               code:
 *                 type: string
 *                 example: VEG
 *     responses:
 *       201:
 *         description: Category created successfully
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
 *                   example: Category created successfully
 *                 data:
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
  checkPerms(['inventory.categories.manage']),
  validate(createCategory),
  async (req, res, next) => {
    try { const r = await svc.create(req.tenantDb, req.body); return res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/inventory/categories:
 *   get:
 *     tags:
 *       - Inventory Categories
 *     summary: Get all inventory categories
 *     description: Retrieve list of all inventory categories
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - $ref: '#/components/parameters/search'
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
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
 *                   example: Categories retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       code:
 *                         type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/',
  checkPerms(['inventory.categories.read'], { any: true }),
  async (req, res, next) => {
    try { const r = await svc.list(req.tenantDb, req.query); return res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/inventory/categories/{id}:
 *   get:
 *     tags:
 *       - Inventory Categories
 *     summary: Get category by ID
 *     description: Retrieve a specific inventory category
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Category retrieved successfully
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
  checkPerms(['inventory.categories.read'], { any: true }),
  async (req, res, next) => {
    try { const r = await svc.get(req.tenantDb, req.params.id); return res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/inventory/categories/{id}:
 *   put:
 *     tags:
 *       - Inventory Categories
 *     summary: Update category
 *     description: Update an inventory category
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
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
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Category updated successfully
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
  checkPerms(['inventory.categories.manage']),
  validate(updateCategory),
  async (req, res, next) => {
    try { const r = await svc.update(req.tenantDb, req.params.id, req.body); return res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/inventory/categories/{id}:
 *   delete:
 *     tags:
 *       - Inventory Categories
 *     summary: Delete category
 *     description: Delete an inventory category (only if no items are assigned to it)
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Category deleted successfully
 *       400:
 *         description: Cannot delete category with assigned items
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
  checkPerms(['inventory.categories.manage']),
  async (req, res, next) => {
    try { const r = await svc.del(req.tenantDb, req.params.id, ItemRepo); return res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

module.exports = router;
