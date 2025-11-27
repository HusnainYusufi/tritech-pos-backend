const express = require('express');
const router = express.Router();

const validate = require('../../../middlewares/validate');
const tenantContext = require('../../../middlewares/tenantContext');
const logger = require('../../../modules/logger');
const AppError = require('../../../modules/AppError');

const TenantAuthService = require('../services/TenantAuthService');
const { registerOwner, login, loginPin, forgotPassword, resetPassword } = require('../validation/tenantAuth.validation');

router.use(tenantContext);

router.post('/register-owner', validate(registerOwner), async (req, res, next) => {
  try { const r = await TenantAuthService.registerOwner(req.tenantDb, req.body); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

router.post('/login', validate(login), async (req, res, next) => {
  try { const r = await TenantAuthService.login(req.tenantDb, req.body); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

router.post('/login-pin', validate(loginPin), async (req, res, next) => {
  try { const r = await TenantAuthService.loginWithPin(req.tenantDb, req.body); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

router.post('/accept-invite', async (req, res, next) => {
  try {
    const { token, password, fullName } = req.body || {};
    if (!token || !password) throw new AppError('token and password are required', 400);
    const r = await TenantAuthService.acceptInvite(req.tenantDb, { token, password, fullName });
    return res.status(r.status).json(r);
  } catch (e) { logger.error(e); next(e); }
});

router.post('/forgot-password', validate(forgotPassword), async (req, res, next) => {
  try { const r = await TenantAuthService.forgotPassword(req.tenantDb, req.body); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

router.post('/reset-password', validate(resetPassword), async (req, res, next) => {
  try { const r = await TenantAuthService.resetPassword(req.tenantDb, req.body); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

router.get('/me', async (req, res, next) => {
  try {
    const uid = req.user?.uid;
    if (!uid) throw new AppError('Unauthorized', 401);
    const r = await TenantAuthService.me(req.tenantDb, { uid });
    return res.status(r.status).json(r);
  } catch (e) { logger.error(e); next(e); }
});

module.exports = router;
