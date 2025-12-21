'use strict';

const express = require('express');
const router = express.Router();

const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const svc = require('../services/branchMenu.service');

const {
  createBranchMenuConfig,
  updateBranchMenuConfig,
  listBranchMenuConfig,
  listEffectiveBranchMenu,
} = require('../validation/branchMenu.validation');

// Inject tenant
router.use(tenantContext);

/**
 * @swagger
 * /t/branch-menu/effective:
 *   get:
 *     tags:
 *       - Branch Menu
 *     summary: Get effective branch menu
 *     description: |
 *       Retrieve the effective menu for a branch with:
 *       - Branch-specific availability overrides
 *       - Branch-specific pricing
 *       - Only items available at this branch
 *       - Merged with global menu configuration
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: branchId
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID
 *       - name: categoryId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - name: availableOnly
 *         in: query
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Show only available items
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Effective menu retrieved successfully
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
 *                         $ref: '#/components/schemas/MenuItem'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
  '/effective',
  checkPerms(['menu.items.read'], { any: true, branchQuery: 'branchId' }),
  async (req, res, next) => {
    try {
      const { tenantDb } = req;
      const response = await svc.listEffective(tenantDb, req.query);
      return res.status(response.status).json(response);
    } catch (err) {
      logger.error('GET /t/branch-menu/effective failed', err);
      next(err);
    }
  }
);

/**
 * @swagger
 * /t/branch-menu:
 *   get:
 *     tags:
 *       - Branch Menu
 *     summary: Get branch menu configurations
 *     description: Retrieve raw branch menu configuration records
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: branchId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by branch
 *       - name: menuItemId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by menu item
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Branch menu configs retrieved successfully
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
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
  '/',
  checkPerms(['menu.items.read'], { any: true, branchQuery: 'branchId' }),
  validate(listBranchMenuConfig),
  async (req, res, next) => {
    try {
      const { tenantDb } = req;
      const response = await svc.list(tenantDb, req.query);
      return res.status(response.status).json(response);
    } catch (err) {
      logger.error('GET /t/branch-menu failed', err);
      next(err);
    }
  }
);

/**
 * @swagger
 * /t/branch-menu:
 *   post:
 *     tags:
 *       - Branch Menu
 *     summary: Create/upsert branch menu config
 *     description: |
 *       Create or update branch-specific menu configuration:
 *       - Override availability
 *       - Set branch-specific pricing
 *       - Configure item visibility per branch
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
 *               - menuItemId
 *             properties:
 *               branchId:
 *                 type: string
 *                 example: branch_1234567890
 *               menuItemId:
 *                 type: string
 *                 example: item_1234567890
 *               isAvailable:
 *                 type: boolean
 *                 example: true
 *               branchPrice:
 *                 type: number
 *                 example: 15.99
 *                 description: Override default price
 *     responses:
 *       201:
 *         description: Branch menu config created successfully
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
  '/',
  checkPerms(['menu.items.manage'], { branchBody: 'branchId' }),
  validate(createBranchMenuConfig),
  async (req, res, next) => {
    try {
      const conn = req.tenantDb || req.tenantConnection;
      const response = await svc.upsert(conn, req.body);
      return res.status(response.status).json(response);
    } catch (err) {
      logger.error('POST /t/branch-menu failed', err);
      next(err);
    }
  }
);

/**
 * @swagger
 * /t/branch-menu/{id}:
 *   put:
 *     tags:
 *       - Branch Menu
 *     summary: Update branch menu config
 *     description: Update existing branch menu configuration
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch menu config ID
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
 *               isAvailable:
 *                 type: boolean
 *               branchPrice:
 *                 type: number
 *     responses:
 *       200:
 *         description: Branch menu config updated successfully
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
  '/:id',
  checkPerms(['menu.items.manage']),
  validate(updateBranchMenuConfig),
  async (req, res, next) => {
    try {
      const conn = req.tenantDb || req.tenantConnection;
      const response = await svc.updateById(conn, req.params.id, req.body);
      return res.status(response.status).json(response);
    } catch (err) {
      logger.error('PUT /t/branch-menu/:id failed', err);
      next(err);
    }
  }
);

/**
 * @swagger
 * /t/branch-menu/{id}:
 *   delete:
 *     tags:
 *       - Branch Menu
 *     summary: Delete branch menu config
 *     description: Remove branch-specific menu configuration (reverts to default)
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch menu config ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Branch menu config deleted successfully
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
  '/:id',
  checkPerms(['menu.items.manage']),
  async (req, res, next) => {
    try {
      const { tenantDb } = req;

      const response = await svc.delete(tenantDb, req.params.id);
      return res.status(response.status).json(response);
    } catch (err) {
      logger.error('DELETE /t/branch-menu/:id failed', err);
      next(err);
    }
  }
);

module.exports = router;
