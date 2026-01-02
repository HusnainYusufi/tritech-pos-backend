const express = require('express');
const router = express.Router();

const validate = require('../../../middlewares/validate');
const tenantContext = require('../../../middlewares/tenantContext');
const logger = require('../../../modules/logger');
const AppError = require('../../../modules/AppError');

const TenantAuthService = require('../services/TenantAuthService');
const { registerOwner, login, loginPin, logoutPin, forgotPassword, resetPassword } = require('../validation/tenantAuth.validation');

// NOTE: tenantContext is applied selectively below
// accept-invite is PUBLIC and does NOT use tenantContext

/**
 * @swagger
 * /t/auth/register-owner:
 *   post:
 *     tags:
 *       - Tenant Authentication
 *     summary: Register tenant owner
 *     description: Creates the owner account for a tenant
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - fullName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: owner@restaurant.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: SecurePass123!
 *               fullName:
 *                 type: string
 *                 example: Restaurant Owner
 *     responses:
 *       201:
 *         description: Owner registered successfully
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
 *                   example: Owner registered successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/register-owner', tenantContext, validate(registerOwner), async (req, res, next) => {
  try { const r = await TenantAuthService.registerOwner(req.tenantDb, req.body, req.tenantSlug); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

/**
 * @swagger
 * /t/auth/login:
 *   post:
 *     tags:
 *       - Tenant Authentication
 *     summary: Tenant user login
 *     description: Authenticate tenant user with email and password
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@restaurant.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePass123!
 *     responses:
 *       200:
 *         description: Login successful
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
 *                   example: Login successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/login', tenantContext, validate(login), async (req, res, next) => {
  try { const r = await TenantAuthService.login(req.tenantDb, req.body, req.tenantSlug); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

/**
 * @swagger
 * /t/auth/login-pin:
 *   post:
 *     tags:
 *       - Tenant Authentication
 *     summary: Login with PIN
 *     description: Authenticate staff member using PIN for POS access
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pin
 *               - terminalId
 *             properties:
 *               pin:
 *                 type: string
 *                 example: "1234"
 *                 description: 4-digit PIN
 *               terminalId:
 *                 type: string
 *                 example: terminal_1234567890
 *                 description: POS terminal identifier
 *     responses:
 *       200:
 *         description: PIN login successful
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
 *                   example: Login successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/Staff'
 *                     token:
 *                       type: string
 *                     tillSession:
 *                       type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/login-pin', tenantContext, validate(loginPin), async (req, res, next) => {
  try { const r = await TenantAuthService.loginWithPin(req.tenantDb, req.body, req.tenantSlug); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

/**
 * @swagger
 * /t/auth/logout-pin:
 *   post:
 *     tags:
 *       - Tenant Authentication
 *     summary: Logout from PIN session
 *     description: End the current till session for PIN-authenticated user
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
 *             properties:
 *               tillSessionId:
 *                 type: string
 *                 example: session_1234567890
 *     responses:
 *       200:
 *         description: Logout successful
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
 *                   example: Logout successful
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/logout-pin', tenantContext, validate(logoutPin), async (req, res, next) => {
  try { const r = await TenantAuthService.logoutWithPin(req.tenantDb, req.user, req.body, req.tenantSlug); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

/**
 * @swagger
 * /t/auth/accept-invite:
 *   post:
 *     tags:
 *       - Tenant Authentication
 *     summary: Accept staff invitation (PUBLIC)
 *     description: |
 *       Set password for staff account using invitation token.
 *       This is a PUBLIC endpoint - no authentication or tenant header required.
 *       Tenant is resolved from the email address.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - token
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: staff@restaurant.com
 *                 description: Your email address
 *               token:
 *                 type: string
 *                 example: abc123def456...
 *                 description: Token received from admin
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: SecurePass123!
 *               fullName:
 *                 type: string
 *                 example: John Smith
 *                 description: Optional - update full name
 *     responses:
 *       200:
 *         description: Password set successfully
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
 *                   example: Password set successfully. You can now login.
 *                 result:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                       example: staff@restaurant.com
 *                     tenantSlug:
 *                       type: string
 *                       example: restaurant-xyz
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post('/accept-invite', async (req, res, next) => {
  try {
    const { email, token, password, fullName } = req.body || {};
    if (!email || !token || !password) throw new AppError('email, token and password are required', 400);
    // NOTE: No tenantContext middleware - tenant resolved from email in TenantUserDirectory
    const r = await TenantAuthService.acceptInvite({ email, token, password, fullName });
    return res.status(r.status).json(r);
  } catch (e) { logger.error(e); next(e); }
});

/**
 * @swagger
 * /t/auth/forgot-password:
 *   post:
 *     tags:
 *       - Tenant Authentication
 *     summary: Request password reset
 *     description: Send password reset email to tenant user
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@restaurant.com
 *     responses:
 *       200:
 *         description: Password reset email sent
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
 *                   example: Password reset email sent
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post('/forgot-password', tenantContext, validate(forgotPassword), async (req, res, next) => {
  try { const r = await TenantAuthService.forgotPassword(req.tenantDb, req.body); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

/**
 * @swagger
 * /t/auth/reset-password:
 *   post:
 *     tags:
 *       - Tenant Authentication
 *     summary: Reset password
 *     description: Reset tenant user password using token from email
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *                 example: reset_token_from_email
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: NewSecurePass123!
 *     responses:
 *       200:
 *         description: Password reset successful
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
 *                   example: Password reset successful
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post('/reset-password', tenantContext, validate(resetPassword), async (req, res, next) => {
  try { const r = await TenantAuthService.resetPassword(req.tenantDb, req.body); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

/**
 * @swagger
 * /t/auth/me:
 *   get:
 *     tags:
 *       - Tenant Authentication
 *     summary: Get current user
 *     description: Retrieve the currently authenticated tenant user's information
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: User information retrieved successfully
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
 *                   example: User retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/me', tenantContext, async (req, res, next) => {
  try {
    const uid = req.user?.uid;
    if (!uid) throw new AppError('Unauthorized', 401);
    const r = await TenantAuthService.me(req.tenantDb, { uid });
    return res.status(r.status).json(r);
  } catch (e) { logger.error(e); next(e); }
});

module.exports = router;
