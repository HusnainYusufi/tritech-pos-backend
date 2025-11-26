'use strict';
const express = require('express');
const router = express.Router();

const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const svc = require('../services/menuCategory.service');
const { createMenuCategory, updateMenuCategory } = require('../validation/menuCategory.validation');

router.use(tenantContext);

// Create
router.post('/',
  checkPerms(['menu.categories.manage']),
  validate(createMenuCategory),
  async (req, res, next) => {
    try { const r = await svc.create(req.tenantDb, req.body); res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

// List
router.get('/',
  checkPerms(['menu.categories.read'], { any: true }),
  async (req, res, next) => {
    try { const r = await svc.list(req.tenantDb, req.query); res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

// Get one
router.get('/:id',
  checkPerms(['menu.categories.read'], { any: true }),
  async (req, res, next) => {
    try { const r = await svc.get(req.tenantDb, req.params.id); res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

// Update
router.put('/:id',
  checkPerms(['menu.categories.manage']),
  validate(updateMenuCategory),
  async (req, res, next) => {
    try { const r = await svc.update(req.tenantDb, req.params.id, req.body); res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

// Delete
router.delete('/:id',
  checkPerms(['menu.categories.manage']),
  async (req, res, next) => {
    try { const r = await svc.del(req.tenantDb, req.params.id); res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

module.exports = router;
