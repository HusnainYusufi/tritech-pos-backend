'use strict';

const express = require('express');
const router = express.Router();
const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const svc = require('../services/recipeVariant.service');
const { createVariant, updateVariant } = require('../validation/recipeVariant.validation');

router.use(tenantContext);

// Create
router.post('/',
  checkPerms(['recipes.manage']),
  validate(createVariant),
  async (req, res, next) => {
    try { const r = await svc.create(req.tenantDb, req.body); res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

// List
router.get('/',
  checkPerms(['recipes.read'], { any: true }),
  async (req, res, next) => {
    try { const r = await svc.list(req.tenantDb, req.query); res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

// Get one
router.get('/:id',
  checkPerms(['recipes.read'], { any: true }),
  async (req, res, next) => {
    try { const r = await svc.get(req.tenantDb, req.params.id); res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

// Update
router.put('/:id',
  checkPerms(['recipes.manage']),
  validate(updateVariant),
  async (req, res, next) => {
    try { const r = await svc.update(req.tenantDb, req.params.id, req.body); res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

// Delete
router.delete('/:id',
  checkPerms(['recipes.manage']),
  async (req, res, next) => {
    try { const r = await svc.del(req.tenantDb, req.params.id); res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

module.exports = router;
