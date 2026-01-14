'use strict';

const express = require('express');
const router = express.Router();

const tenantContext = require('../../../../middlewares/tenantContext');
const checkPerms = require('../../../../middlewares/tenantCheckPermissions');
const validate = require('../../../../middlewares/validate');
const logger = require('../../../../modules/logger');
const AppError = require('../../../../modules/AppError');

const BoomerangmeService = require('../services/BoomerangmeService');
const {
  checkCredentials,
  getInventory,
  updateConfig,
  webhookOrderCompleted,
  webhookOrderRefunded
} = require('../validation/boomerangme.validation');

// ============================================================
// INBOUND ENDPOINTS (Boomerangme calls us - PUBLIC, no JWT)
// These endpoints are called by Boomerangme during app installation
// and when loyalty rules are triggered.
// ============================================================

/**
 * @swagger
 * /integrations/boomerangme/check-credentials:
 *   post:
 *     tags:
 *       - Integrations - Boomerangme
 *     summary: Validate merchant credentials (Boomerangme calls this)
 *     description: |
 *       Called by Boomerangme platform during app installation to verify
 *       that the provided credentials are valid for this tenant.
 *       
 *       This is a PUBLIC endpoint - no JWT required.
 *       Tenant is resolved from the credentials themselves.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                   example: tenantSlug
 *                 value:
 *                   type: string
 *                   example: acme-restaurant
 *           example:
 *             - name: tenantSlug
 *               value: acme-restaurant
 *             - name: apiKey
 *               value: sk_live_xxx
 *     responses:
 *       200:
 *         description: Credentials validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isValid:
 *                   type: boolean
 *                   example: true
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/check-credentials',
  tenantContext,  // Resolve tenant from x-tenant-id header
  validate(checkCredentials),
  async (req, res, next) => {
    try {
      // Credentials come as array directly in body (per Boomerangme spec)
      const credentials = Array.isArray(req.body) ? req.body : (req.body.credentials || []);
      const result = await BoomerangmeService.checkCredentials(req.tenantDb, credentials);
      return res.status(200).json(result);
    } catch (e) {
      logger.error('[Boomerangme] check-credentials error', e);
      // Always return valid JSON for Boomerangme
      return res.status(200).json({ isValid: false });
    }
  }
);

/**
 * @swagger
 * /integrations/boomerangme/get-inventory:
 *   post:
 *     tags:
 *       - Integrations - Boomerangme
 *     summary: Get menu inventory (Boomerangme calls this)
 *     description: |
 *       Called by Boomerangme platform to retrieve the menu structure
 *       for item-based loyalty rules (e.g., "Buy 5 burgers, get 1 free").
 *       
 *       This is a PUBLIC endpoint - no JWT required.
 *       Credentials are validated before returning data.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                 value:
 *                   type: string
 *     responses:
 *       200:
 *         description: Menu inventory in Boomerangme format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 inventoryItems:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         enum: [group, item]
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       items:
 *                         type: array
 *             example:
 *               inventoryItems:
 *                 - type: group
 *                   id: "cat_123"
 *                   title: Burgers
 *                   items:
 *                     - type: item
 *                       id: "item_456"
 *                       title: Classic Burger
 *       401:
 *         description: Invalid credentials
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/get-inventory',
  tenantContext,
  validate(getInventory),
  async (req, res, next) => {
    try {
      const credentials = Array.isArray(req.body) ? req.body : (req.body.credentials || []);
      const result = await BoomerangmeService.getInventory(req.tenantDb, credentials);
      return res.status(200).json(result);
    } catch (e) {
      logger.error('[Boomerangme] get-inventory error', e);
      if (e.status === 401) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      next(e);
    }
  }
);

// ============================================================
// WEBHOOK ENDPOINTS (Frontend/External calls us after events)
// These trigger loyalty actions in Boomerangme.
// ============================================================

/**
 * @swagger
 * /integrations/boomerangme/webhook/order-completed:
 *   post:
 *     tags:
 *       - Integrations - Boomerangme
 *     summary: Trigger loyalty accrual for completed order
 *     description: |
 *       Call this webhook after an order is paid to award loyalty points
 *       to the customer in Boomerangme.
 *       
 *       Requires tenant context (x-tenant-id header or JWT).
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
 *               - orderId
 *             properties:
 *               orderId:
 *                 type: string
 *                 description: POS Order ID
 *                 example: 507f1f77bcf86cd799439011
 *               customerPhone:
 *                 type: string
 *                 description: Customer phone (optional, falls back to order.customerPhone)
 *                 example: "+1234567890"
 *               customerEmail:
 *                 type: string
 *                 description: Customer email (optional)
 *                 example: "john@example.com"
 *               webhookSecret:
 *                 type: string
 *                 description: Optional webhook secret for verification
 *     responses:
 *       200:
 *         description: Loyalty accrual result
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
 *                   example: Loyalty accrual successful
 *                 result:
 *                   type: object
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Order not found
 *       502:
 *         description: Boomerangme API error
 */
router.post('/webhook/order-completed',
  tenantContext,
  validate(webhookOrderCompleted),
  async (req, res, next) => {
    try {
      const { orderId, customerPhone, customerEmail, webhookSecret } = req.body;

      // Optional webhook secret validation
      const secretValid = await BoomerangmeService.validateWebhookSecret(req.tenantDb, webhookSecret);
      if (!secretValid) {
        throw new AppError('Invalid webhook secret', 401);
      }

      const result = await BoomerangmeService.accrueOrder(req.tenantDb, {
        orderId,
        customerPhone,
        customerEmail
      });

      return res.status(result.status).json(result);
    } catch (e) {
      logger.error('[Boomerangme] webhook/order-completed error', e);
      next(e);
    }
  }
);

/**
 * @swagger
 * /integrations/boomerangme/webhook/order-refunded:
 *   post:
 *     tags:
 *       - Integrations - Boomerangme
 *     summary: Reverse loyalty for refunded order
 *     description: |
 *       Call this webhook when an order is refunded to reverse
 *       the loyalty points that were awarded.
 *       
 *       Requires tenant context (x-tenant-id header or JWT).
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
 *               - orderId
 *             properties:
 *               orderId:
 *                 type: string
 *                 description: POS Order ID (used as transactionId)
 *                 example: 507f1f77bcf86cd799439011
 *               transactionId:
 *                 type: string
 *                 description: Boomerangme transaction ID (optional, defaults to orderId)
 *               webhookSecret:
 *                 type: string
 *                 description: Optional webhook secret for verification
 *     responses:
 *       200:
 *         description: Loyalty reversal result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                 message:
 *                   type: string
 *                 result:
 *                   type: object
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       502:
 *         description: Boomerangme API error
 */
router.post('/webhook/order-refunded',
  tenantContext,
  validate(webhookOrderRefunded),
  async (req, res, next) => {
    try {
      const { orderId, transactionId, webhookSecret } = req.body;

      // Optional webhook secret validation
      const secretValid = await BoomerangmeService.validateWebhookSecret(req.tenantDb, webhookSecret);
      if (!secretValid) {
        throw new AppError('Invalid webhook secret', 401);
      }

      const result = await BoomerangmeService.reverseOrder(req.tenantDb, {
        orderId,
        transactionId
      });

      return res.status(result.status).json(result);
    } catch (e) {
      logger.error('[Boomerangme] webhook/order-refunded error', e);
      next(e);
    }
  }
);

// ============================================================
// ADMIN ENDPOINTS (Configure the integration)
// These require authentication and integrations.manage permission.
// ============================================================

/**
 * @swagger
 * /integrations/boomerangme/config:
 *   get:
 *     tags:
 *       - Integrations - Boomerangme
 *     summary: Get Boomerangme configuration
 *     description: |
 *       Retrieve current Boomerangme integration settings for this tenant.
 *       Sensitive fields (appToken, webhookSecret) are masked.
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Configuration retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                 result:
 *                   type: object
 *                   properties:
 *                     isEnabled:
 *                       type: boolean
 *                     appToken:
 *                       type: string
 *                       example: "sk_live_***"
 *                     credentials:
 *                       type: array
 *                     stats:
 *                       type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get('/config',
  tenantContext,
  checkPerms(['integrations.manage', 'settings.manage'], { any: true }),
  async (req, res, next) => {
    try {
      const result = await BoomerangmeService.getConfig(req.tenantDb);
      return res.status(result.status).json(result);
    } catch (e) {
      logger.error('[Boomerangme] GET /config error', e);
      next(e);
    }
  }
);

/**
 * @swagger
 * /integrations/boomerangme/config:
 *   put:
 *     tags:
 *       - Integrations - Boomerangme
 *     summary: Update Boomerangme configuration
 *     description: |
 *       Update Boomerangme integration settings.
 *       
 *       To enable the integration:
 *       1. Set `isEnabled: true`
 *       2. Provide `appToken` from Boomerangme dashboard
 *       3. Set `credentials` that Boomerangme will use to identify you
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
 *             properties:
 *               isEnabled:
 *                 type: boolean
 *                 description: Enable/disable the integration
 *               appToken:
 *                 type: string
 *                 description: X-App-Token from Boomerangme
 *               credentials:
 *                 type: array
 *                 description: Credentials Boomerangme uses to identify this tenant
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     value:
 *                       type: string
 *               webhookSecret:
 *                 type: string
 *                 description: Optional secret to verify webhook calls
 *               apiBaseUrl:
 *                 type: string
 *                 description: Override API URL (for testing)
 *           example:
 *             isEnabled: true
 *             appToken: "app_xxx_xxx"
 *             credentials:
 *               - name: tenantSlug
 *                 value: acme-restaurant
 *               - name: apiKey
 *                 value: sk_live_xxx
 *     responses:
 *       200:
 *         description: Configuration updated
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.put('/config',
  tenantContext,
  checkPerms(['integrations.manage', 'settings.manage'], { any: true }),
  validate(updateConfig),
  async (req, res, next) => {
    try {
      const result = await BoomerangmeService.updateConfig(req.tenantDb, req.body);
      return res.status(result.status).json(result);
    } catch (e) {
      logger.error('[Boomerangme] PUT /config error', e);
      next(e);
    }
  }
);

/**
 * @swagger
 * /integrations/boomerangme/test:
 *   post:
 *     tags:
 *       - Integrations - Boomerangme
 *     summary: Test Boomerangme connection
 *     description: |
 *       Test the connection to Boomerangme API using the configured appToken.
 *       Useful for verifying setup before going live.
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Connection test result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                 message:
 *                   type: string
 *                 result:
 *                   type: object
 *                   properties:
 *                     connected:
 *                       type: boolean
 *                     error:
 *                       type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post('/test',
  tenantContext,
  checkPerms(['integrations.manage', 'settings.manage'], { any: true }),
  async (req, res, next) => {
    try {
      const result = await BoomerangmeService.testConnection(req.tenantDb);
      return res.status(result.status).json(result);
    } catch (e) {
      logger.error('[Boomerangme] POST /test error', e);
      next(e);
    }
  }
);

module.exports = router;
