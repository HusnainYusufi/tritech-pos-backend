const express = require('express');
const router = express.Router();
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');
const AppError = require('../../../modules/AppError');

const { register, login, forgotPassword, resetPassword, requestOTP, verifyOTP, resetPasswordWithOTP } = require('../validation/auth.validation');
const AuthService = require('../services/AuthService');

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Register a new superadmin user
 *     description: Creates a new superadmin account in the system
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
 *                 example: admin@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: SecurePass123!
 *               fullName:
 *                 type: string
 *                 example: John Doe
 *     responses:
 *       201:
 *         description: User registered successfully
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
 *                   example: User registered successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/register', validate(register), async (req, res, next) => {
  try { const r = await AuthService.register(req.body); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Login as superadmin
 *     description: Authenticate and receive a JWT token for superadmin access
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
 *                 example: admin@example.com
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
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/login', validate(login), async (req, res, next) => {
  try { const r = await AuthService.login(req.body); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

/**
 * @swagger
 * /auth/verifyToken:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Verify JWT token
 *     description: Validates a JWT token and returns user information
 *     parameters:
 *       - name: token
 *         in: query
 *         schema:
 *           type: string
 *         description: JWT token to verify (can also be passed in Authorization header)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
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
 *                   example: Token is valid
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/verifyToken', async (req, res, next) => {
  try {
    const token = req.query.token || (req.headers.authorization ? req.headers.authorization.split(' ')[1] : null);
    if (!token) throw new AppError('Token required', 400);
    const r = await AuthService.verifyToken(token);
    return res.status(r.status).json(r);
  } catch (e) { logger.error(e); next(e); }
});

/**
 * @swagger
 * /auth/forgotPassword:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Request password reset
 *     description: Sends a password reset email to the user
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
 *                 example: admin@example.com
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
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/forgotPassword', validate(forgotPassword), async (req, res, next) => {
  try { const r = await AuthService.forgotPassword(req.body); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Reset password
 *     description: Resets user password using the token from email
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
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/reset-password', validate(resetPassword), async (req, res, next) => {
  try { const r = await AuthService.resetPassword(req.body); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

// ==================== OTP-BASED PASSWORD RESET ====================

/**
 * @swagger
 * /auth/password-reset/request-otp:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Request OTP for password reset (Admin)
 *     description: Sends a 6-digit OTP to the admin user's email for password reset
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
 *                 example: admin@example.com
 *     responses:
 *       200:
 *         description: OTP sent successfully
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
 *                   example: OTP sent to your email. Please check your inbox.
 *                 result:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                       example: admin@example.com
 *                     expiresIn:
 *                       type: string
 *                       example: 10 minutes
 *       429:
 *         description: Too many requests
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/password-reset/request-otp', validate(requestOTP), async (req, res, next) => {
  try {
    const metadata = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent')
    };
    const r = await AuthService.requestPasswordResetOTP(req.body, metadata);
    return res.status(r.status).json(r);
  } catch (e) { logger.error(e); next(e); }
});

/**
 * @swagger
 * /auth/password-reset/verify-otp:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Verify OTP for password reset (Admin)
 *     description: Verifies the 6-digit OTP sent to the admin user's email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@example.com
 *               otp:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OTP verified successfully
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
 *                   example: OTP verified successfully. You can now reset your password.
 *       400:
 *         description: Invalid OTP or max attempts exceeded
 */
router.post('/password-reset/verify-otp', validate(verifyOTP), async (req, res, next) => {
  try {
    const r = await AuthService.verifyPasswordResetOTP(req.body);
    return res.status(r.status).json(r);
  } catch (e) { logger.error(e); next(e); }
});

/**
 * @swagger
 * /auth/password-reset/reset:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Reset password with verified OTP (Admin)
 *     description: Resets the admin user's password after OTP verification
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
 *                 example: admin@example.com
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
 *                   example: Password reset successful. You can now login with your new password.
 *       400:
 *         description: No verified OTP found or invalid request
 */
router.post('/password-reset/reset', validate(resetPasswordWithOTP), async (req, res, next) => {
  try {
    const r = await AuthService.resetPasswordWithOTP(req.body);
    return res.status(r.status).json(r);
  } catch (e) { logger.error(e); next(e); }
});

module.exports = router;
