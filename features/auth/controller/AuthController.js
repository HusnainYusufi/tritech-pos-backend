const express = require('express');
const router = express.Router();
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');
const AppError = require('../../../modules/AppError');

const { register, login, forgotPassword, resetPassword } = require('../validation/auth.validation');
const AuthService = require('../services/AuthService');

// POST /auth/register
router.post('/register', validate(register), async (req, res, next) => {
  try { const r = await AuthService.register(req.body); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

// POST /auth/login
router.post('/login', validate(login), async (req, res, next) => {
  try { const r = await AuthService.login(req.body); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

// GET /auth/verifyToken?token=...
router.get('/verifyToken', async (req, res, next) => {
  try {
    const token = req.query.token || (req.headers.authorization ? req.headers.authorization.split(' ')[1] : null);
    if (!token) throw new AppError('Token required', 400);
    const r = await AuthService.verifyToken(token);
    return res.status(r.status).json(r);
  } catch (e) { logger.error(e); next(e); }
});

// POST /auth/forgotPassword
router.post('/forgotPassword', validate(forgotPassword), async (req, res, next) => {
  try { const r = await AuthService.forgotPassword(req.body); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

// POST /auth/reset-password
router.post('/reset-password', validate(resetPassword), async (req, res, next) => {
  try { const r = await AuthService.resetPassword(req.body); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

module.exports = router;
