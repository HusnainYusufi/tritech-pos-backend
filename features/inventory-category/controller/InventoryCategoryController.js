'use strict';
const express = require('express');
const router = express.Router();

const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const svc = require('../services/inventoryCategory.service');
const { createCategory, updateCategory } = require('../validation/inventoryCategory.validation');
const ItemRepo = require('../../inventory/repository/inventoryItem.repository'); // for delete guard

router.use(tenantContext);

// Create
router.post('/',
  checkPerms(['inventory.categories.manage']),
  validate(createCategory),
  async (req, res, next) => {
    try { const r = await svc.create(req.tenantDb, req.body); return res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

// List
router.get('/',
  checkPerms(['inventory.categories.read'], { any: true }),
  async (req, res, next) => {
    try { const r = await svc.list(req.tenantDb, req.query); return res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

// Get one
router.get('/:id',
  checkPerms(['inventory.categories.read'], { any: true }),
  async (req, res, next) => {
    try { const r = await svc.get(req.tenantDb, req.params.id); return res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

// Update
router.put('/:id',
  checkPerms(['inventory.categories.manage']),
  validate(updateCategory),
  async (req, res, next) => {
    try { const r = await svc.update(req.tenantDb, req.params.id, req.body); return res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

// Delete (guarded)
router.delete('/:id',
  checkPerms(['inventory.categories.manage']),
  async (req, res, next) => {
    try { const r = await svc.del(req.tenantDb, req.params.id, ItemRepo); return res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

module.exports = router;
