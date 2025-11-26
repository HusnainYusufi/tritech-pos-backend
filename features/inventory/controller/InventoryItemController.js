'use strict';
const express = require('express');
const router = express.Router();

const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const svc = require('../services/inventoryItem.service');
const { createItem, updateItem } = require('../validation/inventoryItem.validation');

router.use(tenantContext);

// Create
router.post('/items',
  checkPerms(['inventory.items.manage']),
  validate(createItem),
  async (req, res, next) => {
    try {
      const r = await svc.create(req.tenantDb, req.tenantSlug, req.body);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

// List
router.get('/items',
  checkPerms(['inventory.items.read'], { any: true }),
  async (req, res, next) => {
    try { const r = await svc.list(req.tenantDb, req.query); return res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

// Get one
router.get('/items/:id',
  checkPerms(['inventory.items.read'], { any: true }),
  async (req, res, next) => {
    try { const r = await svc.get(req.tenantDb, req.params.id); return res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

// Update
router.put('/items/:id',
  checkPerms(['inventory.items.manage']),
  validate(updateItem),
  async (req, res, next) => {
    try { const r = await svc.update(req.tenantDb, req.params.id, req.body); return res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

// Delete
router.delete('/items/:id',
  checkPerms(['inventory.items.manage']),
  async (req, res, next) => {
    try { const r = await svc.del(req.tenantDb, req.params.id); return res.status(r.status).json(r); }
    catch (e) { logger.error(e); next(e); }
  }
);

// Inventory dashboard stats
router.get('/stats',
  checkPerms(['inventory.items.read'], { any: true }),
  async (req, res, next) => {
    try {
      const r = await svc.getStats(req.tenantDb);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);


module.exports = router;
