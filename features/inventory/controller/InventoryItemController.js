'use strict';
const express = require('express');
const router = express.Router();

const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const svc = require('../services/inventoryItem.service');
const { createItem, updateItem } = require('../validation/inventoryItem.validation');

router.use(tenantContext);

/**
 * @swagger
 * /t/inventory/items:
 *   post:
 *     tags:
 *       - Inventory
 *     summary: Create inventory item
 *     description: Create a new inventory item with SKU generation
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
 *               - categoryId
 *               - unit
 *             properties:
 *               name:
 *                 type: string
 *                 example: Tomatoes
 *               categoryId:
 *                 type: string
 *                 example: cat_1234567890
 *               unit:
 *                 type: string
 *                 example: kg
 *               reorderLevel:
 *                 type: number
 *                 example: 10
 *               costPrice:
 *                 type: number
 *                 example: 2.50
 *               supplier:
 *                 type: string
 *                 example: Fresh Produce Co.
 *     responses:
 *       201:
 *         description: Item created successfully
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
 *                   example: Item created successfully
 *                 data:
 *                   $ref: '#/components/schemas/InventoryItem'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/items',
  checkPerms(['inventory.items.manage']),
  validate(createItem),
  async (req, res, next) => {
    try {
      const r = await svc.create(req.tenantDb, req.tenantSlug, req.body);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/inventory/items:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Get all inventory items
 *     description: Retrieve list of all inventory items with filtering and pagination
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - $ref: '#/components/parameters/search'
 *       - name: categoryId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by category ID
 *       - name: lowStock
 *         in: query
 *         schema:
 *           type: boolean
 *         description: Filter items with low stock
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Items retrieved successfully
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
 *                   example: Items retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/InventoryItem'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/items',
  checkPerms(['inventory.items.read'], { any: true }),
  async (req, res, next) => {
    try { const r = await svc.list(req.tenantDb, req.query); return res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/inventory/items/{id}:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Get inventory item by ID
 *     description: Retrieve detailed information about a specific inventory item
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Item ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Item retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   $ref: '#/components/schemas/InventoryItem'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/items/:id',
  checkPerms(['inventory.items.read'], { any: true }),
  async (req, res, next) => {
    try { const r = await svc.get(req.tenantDb, req.params.id); return res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/inventory/items/{id}:
 *   put:
 *     tags:
 *       - Inventory
 *     summary: Update inventory item
 *     description: Update inventory item details
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Item ID
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
 *               categoryId:
 *                 type: string
 *               unit:
 *                 type: string
 *               reorderLevel:
 *                 type: number
 *               costPrice:
 *                 type: number
 *               supplier:
 *                 type: string
 *     responses:
 *       200:
 *         description: Item updated successfully
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
router.put('/items/:id',
  checkPerms(['inventory.items.manage']),
  validate(updateItem),
  async (req, res, next) => {
    try { const r = await svc.update(req.tenantDb, req.params.id, req.body); return res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/inventory/items/{id}:
 *   delete:
 *     tags:
 *       - Inventory
 *     summary: Delete inventory item
 *     description: Delete an inventory item
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Item ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Item deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/items/:id',
  checkPerms(['inventory.items.manage']),
  async (req, res, next) => {
    try { const r = await svc.del(req.tenantDb, req.params.id); return res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/inventory/stats:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Get inventory statistics
 *     description: Retrieve inventory dashboard statistics (total items, low stock, value, etc.)
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalItems:
 *                       type: integer
 *                       example: 250
 *                     lowStockItems:
 *                       type: integer
 *                       example: 15
 *                     totalValue:
 *                       type: number
 *                       example: 50000.00
 *                     categories:
 *                       type: integer
 *                       example: 12
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/stats',
  checkPerms(['inventory.items.read'], { any: true }),
  async (req, res, next) => {
    try {
      const r = await svc.getStats(req.tenantDb);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);


module.exports = router;
