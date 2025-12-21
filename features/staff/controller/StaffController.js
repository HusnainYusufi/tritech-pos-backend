// features/staff/controller/StaffController.js
'use strict';

const express = require('express');
const router = express.Router();

const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const StaffService = require('../services/StaffService');
const { createStaff, updateStaff, listStaff, updatePin, updateStatus } = require('../validation/staff.validation');

const branchContext = (req) => req.params?.branchId || req.body?.branchId || req.query?.branchId || req.header('x-branch-id') || null;

router.use(tenantContext);

/**
 * @swagger
 * /t/staff:
 *   post:
 *     tags:
 *       - Staff
 *     summary: Create staff member
 *     description: Create a new staff member with role and permissions
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
 *               - fullName
 *               - email
 *               - role
 *               - branchId
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: John Smith
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@restaurant.com
 *               phone:
 *                 type: string
 *                 example: +1234567890
 *               role:
 *                 type: string
 *                 example: cashier
 *               branchId:
 *                 type: string
 *                 example: branch_1234567890
 *               pin:
 *                 type: string
 *                 example: "1234"
 *                 description: 4-digit PIN for POS login
 *     responses:
 *       201:
 *         description: Staff member created successfully
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
 *                   example: Staff created successfully
 *                 data:
 *                   $ref: '#/components/schemas/Staff'
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
  checkPerms(['staff.manage'], { any: true, branchParam: 'branchId' }),
  validate(createStaff),
  async (req, res, next) => {
    try {
      const r = await StaffService.create(req.tenantDb, req.user?.uid, req.body, branchContext(req));
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/staff:
 *   get:
 *     tags:
 *       - Staff
 *     summary: Get all staff members
 *     description: Retrieve list of all staff members with filtering
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - $ref: '#/components/parameters/search'
 *       - name: branchId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by branch ID
 *       - name: role
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by role
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter by status
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Staff members retrieved successfully
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
 *                   example: Staff retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Staff'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/',
  checkPerms(['staff.read'], { any: true, branchParam: 'branchId' }),
  validate(listStaff, 'query'),
  async (req, res, next) => {
    try {
      const r = await StaffService.list(req.tenantDb, req.user?.uid, req.query, branchContext(req));
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/staff/{id}:
 *   get:
 *     tags:
 *       - Staff
 *     summary: Get staff member by ID
 *     description: Retrieve detailed information about a specific staff member
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Staff ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Staff member retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   $ref: '#/components/schemas/Staff'
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
  checkPerms(['staff.read'], { any: true, branchParam: 'branchId' }),
  async (req, res, next) => {
    try {
      const r = await StaffService.get(req.tenantDb, req.user?.uid, req.params.id, branchContext(req));
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/staff/{id}:
 *   put:
 *     tags:
 *       - Staff
 *     summary: Update staff member
 *     description: Update staff member information
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Staff ID
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
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               role:
 *                 type: string
 *               branchId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Staff member updated successfully
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
  checkPerms(['staff.manage'], { any: true, branchParam: 'branchId' }),
  validate(updateStaff),
  async (req, res, next) => {
    try {
      const r = await StaffService.update(req.tenantDb, req.user?.uid, req.params.id, req.body, branchContext(req));
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/staff/{id}/set-pin:
 *   post:
 *     tags:
 *       - Staff
 *     summary: Set staff PIN
 *     description: Set or update the 4-digit PIN for POS login
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Staff ID
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
 *               - pin
 *             properties:
 *               pin:
 *                 type: string
 *                 example: "1234"
 *                 description: 4-digit PIN
 *     responses:
 *       200:
 *         description: PIN set successfully
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
 *                   example: PIN updated successfully
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
router.post('/:id/set-pin',
  checkPerms(['staff.manage'], { any: true, branchParam: 'branchId' }),
  validate(updatePin),
  async (req, res, next) => {
    try {
      const r = await StaffService.setPin(req.tenantDb, req.user?.uid, req.params.id, req.body, branchContext(req));
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/staff/{id}/status:
 *   post:
 *     tags:
 *       - Staff
 *     summary: Update staff status
 *     description: Activate or deactivate a staff member
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Staff ID
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 example: active
 *     responses:
 *       200:
 *         description: Status updated successfully
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
router.post('/:id/status',
  checkPerms(['staff.manage'], { any: true, branchParam: 'branchId' }),
  validate(updateStatus),
  async (req, res, next) => {
    try {
      const r = await StaffService.setStatus(req.tenantDb, req.user?.uid, req.params.id, req.body, branchContext(req));
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

module.exports = router;
