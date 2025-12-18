// features/branch/controller/BranchController.js
const express = require('express');
const router = express.Router();

const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const svc = require('../services/BranchService');
const { createBranch, updateBranch, updateSettings, branchUser } = require('../validation/branch.validation');

router.use(tenantContext);

// Create
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

// List branches
// PUBLIC ENDPOINT - No authentication required
// This is needed for the cashier login screen to show available branches
router.get('/',
  // NO checkPerms - this is public for cashier login flow
  // Cashiers need to select their branch BEFORE logging in
  async (req, res, next) => {
    try {
      const r = await svc.list(req.tenantDb, req.query);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

// Get one
router.get('/:id',
  checkPerms(['branches.read'], { any: true }),
  async (req, res, next) => {
    try {
      const r = await svc.get(req.tenantDb, req.params.id);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

// Update
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

// Delete
router.delete('/:id',
  checkPerms(['branches.manage']),
  async (req, res, next) => {
    try {
      const r = await svc.del(req.tenantDb, req.params.id);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

// Set default
router.post('/:id/set-default',
  checkPerms(['branches.manage']),
  async (req, res, next) => {
    try {
      const r = await svc.setDefault(req.tenantDb, req.params.id);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

// Settings (GET)
router.get('/:branchId/settings',
  checkPerms(['branches.read'], { any: true, branchParam: 'branchId' }),
  async (req, res, next) => {
    try {
      const r = await svc.getSettings(req.tenantDb, req.params.branchId);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

// Settings (PUT)
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

// Attach user to branchIds (optional convenience)
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

// Summary (for dashboard cards)
router.get('/:branchId/summary',
  checkPerms(['branches.read'], { any: true, branchParam: 'branchId' }),
  async (req, res, next) => {
    try {
      const r = await svc.summary(req.tenantDb, req.params.branchId);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);


module.exports = router;
