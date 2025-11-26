'use strict';
const express = require('express');
const router = express.Router();

const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const svc = require('../services/menuVariation.service');
const { createMenuVariation, updateMenuVariation } = require('../validation/menuVariation.validation');

router.use(tenantContext);

// Create
router.post('/',
  checkPerms(['menu.variations.manage']),
  validate(createMenuVariation),
  async (req, res, next) => {
    try { const r = await svc.create(req.tenantDb, req.body); res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

// List
router.get('/',
  checkPerms(['menu.variations.read'], { any: true }),
  async (req, res, next) => {
    try { const r = await svc.list(req.tenantDb, req.query); res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

// List by menuItem
router.get('/by-item/:menuItemId',
  checkPerms(['menu.variations.read'], { any: true }),
  async (req, res, next) => {
    try { const r = await svc.listByMenuItem(req.tenantDb, req.params.menuItemId, req.query); res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

// Get one
router.get('/:id',
  checkPerms(['menu.variations.read'], { any: true }),
  async (req, res, next) => {
    try { const r = await svc.get(req.tenantDb, req.params.id); res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

// Update
router.put('/:id',
  checkPerms(['menu.variations.manage']),
  validate(updateMenuVariation),
  async (req, res, next) => {
    try { const r = await svc.update(req.tenantDb, req.params.id, req.body); res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

// Delete
router.delete('/:id',
  checkPerms(['menu.variations.manage']),
  async (req, res, next) => {
    try { const r = await svc.del(req.tenantDb, req.params.id); res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

module.exports = router;
