// features/pos/controller/PosTerminalController.js
'use strict';

const express = require('express');
const router = express.Router();

const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const PosTerminalService = require('../services/PosTerminalService');
const { createTerminal, listTerminals, updateTerminal } = require('../validation/posTerminal.validation');

router.use(tenantContext);

/**
 * @swagger
 * /t/pos/terminals:
 *   post:
 *     tags:
 *       - POS Terminal
 *     summary: Create POS terminal
 *     description: Register a new POS terminal for a branch
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
 *               - branchId
 *             properties:
 *               name:
 *                 type: string
 *                 example: Terminal 1
 *               code:
 *                 type: string
 *                 example: POS-001
 *               branchId:
 *                 type: string
 *                 example: branch_1234567890
 *               deviceId:
 *                 type: string
 *                 example: device_abc123
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 example: active
 *     responses:
 *       201:
 *         description: Terminal created successfully
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
 *                   example: Terminal created successfully
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
router.post('/terminals',
  checkPerms(['pos.manage']),
  validate(createTerminal),
  async (req, res, next) => {
    try {
      const r = await PosTerminalService.create(req.tenantDb, req.user, req.body);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/pos/terminals:
 *   get:
 *     tags:
 *       - POS Terminal
 *     summary: Get all terminals (PUBLIC)
 *     description: |
 *       Retrieve list of all POS terminals. 
 *       This is a PUBLIC endpoint needed for the cashier login screen to show available terminals.
 *       Cashiers need to select their terminal BEFORE logging in.
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: branchId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by branch ID
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: Terminals retrieved successfully
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
 *                   example: Terminals retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       code:
 *                         type: string
 *                       branchId:
 *                         type: string
 *                       status:
 *                         type: string
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/terminals',
  validate(listTerminals, 'query'),
  async (req, res, next) => {
    try {
      const r = await PosTerminalService.list(req.tenantDb, null, req.query);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/pos/terminals/{id}:
 *   put:
 *     tags:
 *       - POS Terminal
 *     summary: Update terminal
 *     description: Update POS terminal details
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Terminal ID
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
 *               code:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *               deviceId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Terminal updated successfully
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
router.put('/terminals/:id',
  checkPerms(['pos.manage']),
  validate(updateTerminal),
  async (req, res, next) => {
    try {
      const r = await PosTerminalService.update(req.tenantDb, req.user, req.params.id, req.body);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

module.exports = router;
