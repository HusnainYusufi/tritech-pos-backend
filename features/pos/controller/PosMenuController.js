// features/pos/controller/PosMenuController.js
'use strict';

const express = require('express');
const router = express.Router();

const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const PosMenuService = require('../services/PosMenuService');
const { getPosMenu } = require('../validation/posMenu.validation');

router.use(tenantContext);

/**
 * @swagger
 * /t/pos/menu:
 *   get:
 *     tags:
 *       - POS Menu
 *     summary: Get POS menu
 *     description: |
 *       Retrieve the complete menu for POS display with:
 *       - Categories
 *       - Menu items with prices
 *       - Variations
 *       - Availability status
 *       - Branch-specific menu items
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: branchId
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID to get menu for
 *       - name: categoryId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *         description: Search menu items
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
 *         description: Menu retrieved successfully
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
 *                   example: Menu retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     categories:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           items:
 *                             type: array
 *                             items:
 *                               $ref: '#/components/schemas/MenuItem'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/menu',
  checkPerms(['menu.items.read'], { any: true, branchParam: 'branchId' }),
  validate(getPosMenu, 'query'),
  async (req, res, next) => {
    try {
      const response = await PosMenuService.list(req.tenantDb, req.user, req.query);
      return res.status(response.status).json(response);
    } catch (err) {
      logger.error('GET /t/pos/menu failed', err);
      next(err);
    }
  }
);

module.exports = router;
