// features/branch/controller/BranchController.js
const express = require('express');
const router = express.Router();

const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const svc = require('../services/BranchService');
const BranchConfigService = require('../services/BranchConfigService');
const { createBranch, updateBranch, updateSettings, branchUser, updatePosConfig } = require('../validation/branch.validation');

router.use(tenantContext);

/**
 * @swagger
 * /t/branches:
 *   post:
 *     tags:
 *       - Branches
 *     summary: Create a new branch
 *     description: Create a new branch location for the tenant
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
 *               - code
 *             properties:
 *               name:
 *                 type: string
 *                 example: Main Branch
 *               code:
 *                 type: string
 *                 example: MAIN01
 *               address:
 *                 type: string
 *                 example: 123 Main St, City, Country
 *               phone:
 *                 type: string
 *                 example: +1234567890
 *               email:
 *                 type: string
 *                 format: email
 *                 example: main@restaurant.com
 *               isDefault:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Branch created successfully
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
 *                   example: Branch created successfully
 *                 data:
 *                   $ref: '#/components/schemas/Branch'
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
  checkPerms(['branches.manage']),
  validate(createBranch),
  async (req, res, next) => {
    try {
      const r = await svc.create(req.tenantDb, req.body, req.user?.uid || null);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/branches:
 *   get:
 *     tags:
 *       - Branches
 *     summary: Get all branches (PUBLIC)
 *     description: Retrieve list of all branches. This is a PUBLIC endpoint used for cashier login screen.
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter by branch status
 *     responses:
 *       200:
 *         description: Branches retrieved successfully
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
 *                   example: Branches retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Branch'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/',
  async (req, res, next) => {
    try {
      const r = await svc.list(req.tenantDb, req.query);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/branches/{id}:
 *   get:
 *     tags:
 *       - Branches
 *     summary: Get branch by ID
 *     description: Retrieve detailed information about a specific branch
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Branch retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   $ref: '#/components/schemas/Branch'
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
  checkPerms(['branches.read'], { any: true }),
  async (req, res, next) => {
    try {
      const r = await svc.get(req.tenantDb, req.params.id);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/branches/{id}:
 *   put:
 *     tags:
 *       - Branches
 *     summary: Update branch
 *     description: Update branch information
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID
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
 *               address:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *     responses:
 *       200:
 *         description: Branch updated successfully
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
  checkPerms(['branches.manage']),
  validate(updateBranch),
  async (req, res, next) => {
    try {
      const r = await svc.update(req.tenantDb, req.params.id, req.body);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/branches/{id}:
 *   delete:
 *     tags:
 *       - Branches
 *     summary: Delete branch
 *     description: Delete a branch location
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Branch deleted successfully
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
  checkPerms(['branches.manage']),
  async (req, res, next) => {
    try {
      const r = await svc.del(req.tenantDb, req.params.id);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/branches/{id}/set-default:
 *   post:
 *     tags:
 *       - Branches
 *     summary: Set branch as default
 *     description: Set a branch as the default branch for the tenant
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Default branch set successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/:id/set-default',
  checkPerms(['branches.manage']),
  async (req, res, next) => {
    try {
      const r = await svc.setDefault(req.tenantDb, req.params.id);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/branches/{branchId}/settings:
 *   get:
 *     tags:
 *       - Branches
 *     summary: Get branch settings
 *     description: Retrieve configuration settings for a branch
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: branchId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Settings retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:branchId/settings',
  checkPerms(['branches.read'], { any: true, branchParam: 'branchId' }),
  async (req, res, next) => {
    try {
      const r = await svc.getSettings(req.tenantDb, req.params.branchId);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/branches/{branchId}/settings:
 *   put:
 *     tags:
 *       - Branches
 *     summary: Update branch settings
 *     description: Update configuration settings for a branch
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: branchId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID
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
 *               taxRate:
 *                 type: number
 *                 example: 0.15
 *               currency:
 *                 type: string
 *                 example: USD
 *               timezone:
 *                 type: string
 *                 example: America/New_York
 *     responses:
 *       200:
 *         description: Settings updated successfully
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
router.put('/:branchId/settings',
  checkPerms(['branches.manage'], { branchParam: 'branchId' }),
  validate(updateSettings),
  async (req, res, next) => {
    try {
      const r = await svc.updateSettings(req.tenantDb, req.params.branchId, req.body);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/branches/{branchId}/attach-user:
 *   post:
 *     tags:
 *       - Branches
 *     summary: Attach user to branch
 *     description: Assign a user to a branch
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: branchId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID
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
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 example: user_1234567890
 *     responses:
 *       200:
 *         description: User attached to branch successfully
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
router.post('/:branchId/attach-user',
  checkPerms(['branches.manage'], { branchParam: 'branchId' }),
  validate(branchUser),
  async (req, res, next) => {
    try {
      const r = await svc.attachUser(req.tenantDb, req.params.branchId, req.body.userId);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/branches/{branchId}/detach-user:
 *   post:
 *     tags:
 *       - Branches
 *     summary: Detach user from branch
 *     description: Remove a user from a branch
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: branchId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID
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
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 example: user_1234567890
 *     responses:
 *       200:
 *         description: User detached from branch successfully
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
router.post('/:branchId/detach-user',
  checkPerms(['branches.manage'], { branchParam: 'branchId' }),
  validate(branchUser),
  async (req, res, next) => {
    try {
      const r = await svc.detachUser(req.tenantDb, req.params.branchId, req.body.userId);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/branches/{branchId}/summary:
 *   get:
 *     tags:
 *       - Branches
 *     summary: Get branch summary
 *     description: Retrieve summary statistics for a branch (for dashboard)
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: branchId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Summary retrieved successfully
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
 *                     totalOrders:
 *                       type: integer
 *                       example: 150
 *                     totalRevenue:
 *                       type: number
 *                       example: 5000.00
 *                     activeStaff:
 *                       type: integer
 *                       example: 12
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:branchId/summary',
  checkPerms(['branches.read'], { any: true, branchParam: 'branchId' }),
  async (req, res, next) => {
    try {
      const r = await svc.summary(req.tenantDb, req.params.branchId);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/branches/{branchId}/pos-config:
 *   get:
 *     tags:
 *       - Branches
 *     summary: Get POS configuration for a branch
 *     description: |
 *       Retrieve POS behavior settings and receipt customization for a branch.
 *       Used by frontend after cashier login to determine UI behavior.
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: branchId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: POS configuration retrieved successfully
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
 *                   example: POS configuration retrieved successfully
 *                 result:
 *                   type: object
 *                   properties:
 *                     branchId:
 *                       type: string
 *                     branchName:
 *                       type: string
 *                     currency:
 *                       type: string
 *                       example: PKR
 *                     posConfig:
 *                       type: object
 *                       properties:
 *                         paymentMode:
 *                           type: string
 *                           enum: [payNow, payLater]
 *                           example: payNow
 *                         receiptConfig:
 *                           type: object
 *                         paymentMethods:
 *                           type: object
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:branchId/pos-config',
  checkPerms(['branches.read'], { any: true, branchParam: 'branchId' }),
  async (req, res, next) => {
    try {
      const r = await BranchConfigService.getPosConfig(req.tenantDb, req.params.branchId);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/branches/{branchId}/pos-config:
 *   put:
 *     tags:
 *       - Branches
 *     summary: Update POS configuration for a branch
 *     description: |
 *       Update POS behavior settings and receipt customization.
 *       Changes take effect immediately for all cashiers in this branch.
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: branchId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Branch ID
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
 *               paymentMode:
 *                 type: string
 *                 enum: [payNow, payLater]
 *                 description: Payment workflow mode (payNow=immediate, payLater=bill after service)
 *                 example: payNow
 *               receiptConfig:
 *                 type: object
 *                 properties:
 *                   showLogo:
 *                     type: boolean
 *                   logoUrl:
 *                     type: string
 *                   footerText:
 *                     type: string
 *                   showTaxBreakdown:
 *                     type: boolean
 *                   paperWidth:
 *                     type: number
 *                     enum: [58, 80]
 *               paymentMethods:
 *                 type: object
 *                 properties:
 *                   cash:
 *                     type: object
 *                     properties:
 *                       enabled:
 *                         type: boolean
 *                       taxRateOverride:
 *                         type: number
 *                         nullable: true
 *           examples:
 *             setPayLaterMode:
 *               summary: Enable fine dining mode
 *               value:
 *                 paymentMode: payLater
 *                 enableTableService: true
 *             customizeReceipt:
 *               summary: Customize receipt
 *               value:
 *                 receiptConfig:
 *                   showLogo: true
 *                   logoUrl: https://example.com/logo.png
 *                   footerText: Visit us again!
 *                   showTaxBreakdown: true
 *     responses:
 *       200:
 *         description: POS configuration updated successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put('/:branchId/pos-config',
  checkPerms(['branches.manage', 'branches.settings'], { any: true, branchParam: 'branchId' }),
  validate(updatePosConfig),
  async (req, res, next) => {
    try {
      const r = await BranchConfigService.updatePosConfig(req.tenantDb, req.params.branchId, req.body);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);


module.exports = router;
