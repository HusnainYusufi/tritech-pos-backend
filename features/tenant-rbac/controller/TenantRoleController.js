// features/tenant-rbac/controller/TenantRoleController.js
'use strict';

const express = require('express');
const router = express.Router();

const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const logger = require('../../../modules/logger');

const RoleRepo = require('../repository/tenantRole.repository');

router.use(tenantContext);

/**
 * @swagger
 * /t/rbac/roles:
 *   get:
 *     tags:
 *       - RBAC
 *     summary: Get all roles
 *     description: Retrieve list of all roles for the tenant
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Roles retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       key:
 *                         type: string
 *                         example: manager
 *                       permissions:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["menu.read", "orders.read", "orders.create"]
 *                       scope:
 *                         type: string
 *                         example: tenant
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/roles',
  checkPerms(['rbac.roles:read'], { any: true }),
  async (req, res, next) => {
    try {
      const Role = RoleRepo.model(req.tenantDb);
      const roles = await Role.find({}).sort({ createdAt: -1 }).lean();
      res.json({ status: 200, items: roles });
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/rbac/roles:
 *   post:
 *     tags:
 *       - RBAC
 *     summary: Create a new role
 *     description: Create a new role with specific permissions (requires rbac.roles:manage permission)
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
 *               - key
 *             properties:
 *               key:
 *                 type: string
 *                 example: shift_manager
 *                 description: Unique role identifier
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["menu.read", "orders.read", "orders.create", "staff.read"]
 *                 description: Array of permission strings
 *               scope:
 *                 type: string
 *                 enum: [tenant, branch]
 *                 example: tenant
 *                 description: Role scope level
 *     responses:
 *       200:
 *         description: Role created successfully
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
 *                   example: Role created
 *                 result:
 *                   type: object
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       409:
 *         description: Role key already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 409
 *                 message:
 *                   type: string
 *                   example: Role key already exists
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/roles',
  checkPerms(['rbac.roles:manage']),
  async (req, res, next) => {
    try {
      const { key, permissions = [], scope = 'tenant' } = req.body;
      const Role = RoleRepo.model(req.tenantDb);
      const exists = await Role.findOne({ key });
      if (exists) return res.status(409).json({ status:409, message:'Role key already exists' });
      const doc = await Role.create({ key, permissions, scope });
      res.json({ status: 200, message:'Role created', result: doc });
    } catch (e) { logger.error(e); next(e); }
  }
);

module.exports = router;
