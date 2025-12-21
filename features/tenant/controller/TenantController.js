const express = require('express');
const router = express.Router();
const validate = require('../../../middlewares/validate');
const { createTenant, updateTenant } = require('../validation/tenant.validation');
const TenantService = require('../services/TenantService');
const allow = require('../../../middlewares/rolecheck.middleware');
const upload = require('../../../middlewares/upload.middleware');
const logger = require('../../../modules/logger');
const checkRoles = require('../../../middlewares/checkRoles');

router.use(checkRoles(['superadmin']));

/**
 * @swagger
 * /admin/tenants:
 *   post:
 *     tags:
 *       - Tenants
 *     summary: Create a new tenant
 *     description: Create a new tenant organization (superadmin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - subdomain
 *               - planId
 *             properties:
 *               name:
 *                 type: string
 *                 example: My Restaurant
 *               subdomain:
 *                 type: string
 *                 example: myrestaurant
 *               planId:
 *                 type: string
 *                 example: plan_1234567890
 *               email:
 *                 type: string
 *                 format: email
 *                 example: owner@myrestaurant.com
 *               phone:
 *                 type: string
 *                 example: +1234567890
 *               address:
 *                 type: string
 *                 example: 123 Main St, City, Country
 *     responses:
 *       201:
 *         description: Tenant created successfully
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
 *                   example: Tenant created successfully
 *                 data:
 *                   $ref: '#/components/schemas/Tenant'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/', validate(createTenant), async (req, res, next) => {
  try { const r = await TenantService.create(req.body); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

/**
 * @swagger
 * /admin/tenants:
 *   get:
 *     tags:
 *       - Tenants
 *     summary: Get all tenants
 *     description: Retrieve a list of all tenants with pagination (superadmin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - $ref: '#/components/parameters/search'
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [active, inactive, suspended]
 *         description: Filter by tenant status
 *     responses:
 *       200:
 *         description: Tenants retrieved successfully
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
 *                   example: Tenants retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Tenant'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', async (req, res, next) => {
  try { const r = await TenantService.list(req.query); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

/**
 * @swagger
 * /admin/tenants/{id}:
 *   get:
 *     tags:
 *       - Tenants
 *     summary: Get tenant by ID
 *     description: Retrieve detailed information about a specific tenant (superadmin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Tenant ID
 *         example: tenant_1234567890
 *     responses:
 *       200:
 *         description: Tenant retrieved successfully
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
 *                   example: Tenant retrieved successfully
 *                 data:
 *                   $ref: '#/components/schemas/Tenant'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:id', async (req, res, next) => {
  try { const r = await TenantService.get(req.params.id); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

/**
 * @swagger
 * /admin/tenants/{id}:
 *   put:
 *     tags:
 *       - Tenants
 *     summary: Update tenant
 *     description: Update tenant information (superadmin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Tenant ID
 *         example: tenant_1234567890
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Updated Restaurant Name
 *               email:
 *                 type: string
 *                 format: email
 *                 example: newemail@restaurant.com
 *               phone:
 *                 type: string
 *                 example: +1234567890
 *               address:
 *                 type: string
 *                 example: 456 New St, City, Country
 *               status:
 *                 type: string
 *                 enum: [active, inactive, suspended]
 *                 example: active
 *     responses:
 *       200:
 *         description: Tenant updated successfully
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
 *                   example: Tenant updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/Tenant'
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
router.put('/:id', validate(updateTenant), async (req, res, next) => {
  try { const r = await TenantService.update(req.params.id, req.body); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

/**
 * @swagger
 * /admin/tenants/{id}:
 *   delete:
 *     tags:
 *       - Tenants
 *     summary: Delete tenant
 *     description: Delete a tenant and all associated data (superadmin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Tenant ID
 *         example: tenant_1234567890
 *     responses:
 *       200:
 *         description: Tenant deleted successfully
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
 *                   example: Tenant deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/:id', async (req, res, next) => {
  try { const r = await TenantService.del(req.params.id); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

/**
 * @swagger
 * /admin/tenants/{id}/change-plan:
 *   post:
 *     tags:
 *       - Tenants
 *     summary: Change tenant subscription plan
 *     description: Update the subscription plan for a tenant (superadmin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Tenant ID
 *         example: tenant_1234567890
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planId
 *             properties:
 *               planId:
 *                 type: string
 *                 example: plan_0987654321
 *     responses:
 *       200:
 *         description: Plan changed successfully
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
 *                   example: Plan changed successfully
 *                 data:
 *                   $ref: '#/components/schemas/Tenant'
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
router.post('/:id/change-plan', async (req, res, next) => {
  try { const { planId } = req.body; const r = await TenantService.changePlan(req.params.id, planId); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

/**
 * @swagger
 * /admin/tenants/{id}/logo:
 *   post:
 *     tags:
 *       - Tenants
 *     summary: Upload tenant logo
 *     description: Upload a logo image for the tenant (superadmin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Tenant ID
 *         example: tenant_1234567890
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Logo image file (PNG, JPG, JPEG)
 *     responses:
 *       200:
 *         description: Logo uploaded successfully
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
 *                   example: Logo uploaded successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     logoUrl:
 *                       type: string
 *                       example: /uploads/logo_1234567890.png
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
router.post('/:id/logo', upload.single('file'), async (req, res, next) => {
  try {
    const fileUrl = `/uploads/${req.file.filename}`; // swap to S3 later
    const r = await TenantService.update(req.params.id, { logoUrl: fileUrl });
    return res.status(r.status).json(r);
  } catch (e) { logger.error(e); next(e); }
});

module.exports = router;
