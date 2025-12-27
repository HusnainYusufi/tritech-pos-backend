// features/pos/controller/PosTillController.js
'use strict';

const express = require('express');
const router = express.Router();

const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const PosTillService = require('../services/PosTillService');
const { openTill, closeTill } = require('../validation/posTill.validation');

router.use(tenantContext);

/**
 * @swagger
 * /t/pos/till/open:
 *   post:
 *     tags:
 *       - POS Till
 *     summary: Open till session
 *     description: Open a new till session for cashier with starting cash amount
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
 *               - terminalId
 *               - openingCash
 *             properties:
 *               branchId:
 *                 type: string
 *                 example: branch_1234567890
 *               terminalId:
 *                 type: string
 *                 example: terminal_1234567890
 *               openingCash:
 *                 type: number
 *                 example: 200.00
 *                 description: Starting cash in till
 *     responses:
 *       201:
 *         description: Till session opened successfully
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
 *                   example: Till opened successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     tillSessionId:
 *                       type: string
 *                     openingCash:
 *                       type: number
 *                     openedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/till/open',
  checkPerms(['pos.till.manage'], { branchParam: 'branchId' }),
  validate(openTill),
  async (req, res, next) => {
    try {
      const r = await PosTillService.openTill(req.tenantDb, req.user, req.body);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/pos/till/close:
 *   post:
 *     tags:
 *       - POS Till
 *     summary: Close till session
 *     description: Close till session with cash reconciliation
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
 *               - tillSessionId
 *               - closingCash
 *             properties:
 *               tillSessionId:
 *                 type: string
 *                 example: session_1234567890
 *               branchId:
 *                 type: string
 *                 example: branch_1234567890
 *               closingCash:
 *                 type: number
 *                 example: 450.00
 *                 description: Actual cash in till at closing
 *               notes:
 *                 type: string
 *                 example: All transactions reconciled
 *     responses:
 *       200:
 *         description: Till session closed successfully
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
 *                   example: Till closed successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     tillSessionId:
 *                       type: string
 *                     openingCash:
 *                       type: number
 *                     closingCash:
 *                       type: number
 *                     expectedCash:
 *                       type: number
 *                     difference:
 *                       type: number
 *                     totalSales:
 *                       type: number
 *                     totalOrders:
 *                       type: integer
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
router.post('/till/close',
  checkPerms(['pos.till.manage'], { branchParam: 'branchId' }),
  validate(closeTill),
  async (req, res, next) => {
    try {
      const r = await PosTillService.closeTill(req.tenantDb, req.user, req.body, req.tenantSlug);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/pos/till/session:
 *   get:
 *     tags:
 *       - POS Till
 *     summary: Get current cashier session
 *     description: |
 *       Retrieve complete cashier session data from JWT token including:
 *       - User details
 *       - Till session info
 *       - Current balance
 *       - Session statistics
 *       - Terminal and branch info
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Session data retrieved successfully
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
 *                   example: Session retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/Staff'
 *                     tillSession:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         openingCash:
 *                           type: number
 *                         currentBalance:
 *                           type: number
 *                         openedAt:
 *                           type: string
 *                           format: date-time
 *                     terminal:
 *                       type: object
 *                     branch:
 *                       $ref: '#/components/schemas/Branch'
 *                     stats:
 *                       type: object
 *                       properties:
 *                         totalOrders:
 *                           type: integer
 *                         totalSales:
 *                           type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/till/session',
  checkPerms(['pos.till.manage', 'pos.orders.read'], { any: true }),
  async (req, res, next) => {
    try {
      const r = await PosTillService.getCashierSession(req.tenantDb, req.user);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

module.exports = router;
