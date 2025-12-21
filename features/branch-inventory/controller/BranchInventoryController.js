'use strict';

const express = require('express');
const router = express.Router();

const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const svc = require('../services/branchInventory.service');
const {
  createBranchInventoryItem,
  updateBranchInventoryItem,
} = require('../validation/branchInventory.validation');

// Inject tenant (db, slug, user, permissions, etc.)
router.use(tenantContext);

/**
 * @swagger
 * /t/branch-inventory/items:
 *   get:
 *     tags:
 *       - Branch Inventory
 *     summary: Get branch inventory items
 *     description: |
 *       Retrieve branch-specific inventory items with:
 *       - Current stock levels per branch
 *       - Branch-specific reorder points
 *       - Low stock alerts
 *       - Inventory tracking per location
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: branchId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by branch
 *       - name: q
 *         in: query
 *         schema:
 *           type: string
 *         description: Search query
 *       - name: lowStock
 *         in: query
 *         schema:
 *           type: boolean
 *         description: Show only low stock items
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
 *         description: Branch inventory items retrieved successfully
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
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           branchId:
 *                             type: string
 *                           itemId:
 *                             type: string
 *                           quantity:
 *                             type: number
 *                           reorderPoint:
 *                             type: number
 *                           isLowStock:
 *                             type: boolean
 *                     pagination:
 *                       type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
  '/items',
  checkPerms(['inventory.items.read'], { any: true }),
  async (req, res, next) => {
    try {
      const r = await svc.list(req.tenantDb, req.query);
      return res.status(r.status).json(r);
    } catch (e) {
      logger.error(e);
      next(e);
    }
  },
);

/**
 * @swagger
 * /t/branch-inventory/items:
 *   post:
 *     tags:
 *       - Branch Inventory
 *     summary: Create branch inventory item
 *     description: Add an inventory item to a specific branch with initial stock
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
 *               - branchId
 *               - itemId
 *             properties:
 *               branchId:
 *                 type: string
 *                 example: branch_1234567890
 *               itemId:
 *                 type: string
 *                 example: item_1234567890
 *                 description: Reference to global inventory item
 *               quantity:
 *                 type: number
 *                 example: 100
 *                 description: Initial stock quantity
 *               reorderPoint:
 *                 type: number
 *                 example: 20
 *                 description: Low stock alert threshold
 *               maxStock:
 *                 type: number
 *                 example: 500
 *     responses:
 *       201:
 *         description: Branch inventory item created successfully
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
router.post(
  '/items',
  checkPerms(['inventory.items.manage']),
  validate(createBranchInventoryItem),
  async (req, res, next) => {
    try {
      const r = await svc.create(req.tenantDb, req.tenantSlug, req.body);
      return res.status(r.status).json(r);
    } catch (e) {
      logger.error(e);
      next(e);
    }
  },
);

/**
 * @swagger
 * /t/branch-inventory/items/{id}:
 *   get:
 *     tags:
 *       - Branch Inventory
 *     summary: Get branch inventory item by ID
 *     description: Retrieve detailed information about a specific branch inventory item
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch inventory item ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Branch inventory item retrieved successfully
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
router.get(
  '/items/:id',
  checkPerms(['inventory.items.read'], { any: true }),
  async (req, res, next) => {
    try {
      const r = await svc.get(req.tenantDb, req.params.id);
      return res.status(r.status).json(r);
    } catch (e) {
      logger.error(e);
      next(e);
    }
  },
);

/**
 * @swagger
 * /t/branch-inventory/items/{id}:
 *   put:
 *     tags:
 *       - Branch Inventory
 *     summary: Update branch inventory item
 *     description: |
 *       Update branch inventory item details:
 *       - Adjust stock quantity
 *       - Update reorder point
 *       - Modify max stock levels
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch inventory item ID
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
 *               quantity:
 *                 type: number
 *                 example: 150
 *               reorderPoint:
 *                 type: number
 *                 example: 25
 *               maxStock:
 *                 type: number
 *                 example: 600
 *     responses:
 *       200:
 *         description: Branch inventory item updated successfully
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
router.put(
  '/items/:id',
  checkPerms(['inventory.items.manage']),
  validate(updateBranchInventoryItem),
  async (req, res, next) => {
    try {
      const r = await svc.update(req.tenantDb, req.params.id, req.body);
      return res.status(r.status).json(r);
    } catch (e) {
      logger.error(e);
      next(e);
    }
  },
);

/**
 * @swagger
 * /t/branch-inventory/items/{id}:
 *   delete:
 *     tags:
 *       - Branch Inventory
 *     summary: Delete branch inventory item
 *     description: Remove an inventory item from a branch
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch inventory item ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Branch inventory item deleted successfully
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
router.delete(
  '/items/:id',
  checkPerms(['inventory.items.manage']),
  async (req, res, next) => {
    try {
      const r = await svc.del(req.tenantDb, req.params.id);
      return res.status(r.status).json(r);
    } catch (e) {
      logger.error(e);
      next(e);
    }
  },
);

module.exports = router;
