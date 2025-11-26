'use strict';

const express = require('express');
const router = express.Router();

const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const svc = require('../services/branchInventory.service');
const {
  createBranchInventoryItem,
  updateBranchInventoryItem,
} = require('../validation/branchInventory.validation');

// Inject tenant (db, slug, user, permissions, etc.)
router.use(tenantContext);

/**
 * GET /t/branch-inventory/items
 * Query: branchId=..., q=..., page, limit, sort, order
 */
router.get(
  '/items',
  checkPerms(['inventory.items.read'], { any: true }),
  async (req, res, next) => {
    try {
      const r = await svc.list(req.tenantDb, req.query);
      return res.status(r.status).json(r);
    } catch (e) {
      logger.error(e);
      next(e);
    }
  },
);

/**
 * POST /t/branch-inventory/items
 * Body: { branchId, itemId, quantity?, reorderPoint?, ... }
 */
router.post(
  '/items',
  checkPerms(['inventory.items.manage']),
  validate(createBranchInventoryItem),
  async (req, res, next) => {
    try {
      const r = await svc.create(req.tenantDb, req.tenantSlug, req.body);
      return res.status(r.status).json(r);
    } catch (e) {
      logger.error(e);
      next(e);
    }
  },
);

/**
 * GET /t/branch-inventory/items/:id
 */
router.get(
  '/items/:id',
  checkPerms(['inventory.items.read'], { any: true }),
  async (req, res, next) => {
    try {
      const r = await svc.get(req.tenantDb, req.params.id);
      return res.status(r.status).json(r);
    } catch (e) {
      logger.error(e);
      next(e);
    }
  },
);

/**
 * PUT /t/branch-inventory/items/:id
 */
router.put(
  '/items/:id',
  checkPerms(['inventory.items.manage']),
  validate(updateBranchInventoryItem),
  async (req, res, next) => {
    try {
      const r = await svc.update(req.tenantDb, req.params.id, req.body);
      return res.status(r.status).json(r);
    } catch (e) {
      logger.error(e);
      next(e);
    }
  },
);

/**
 * DELETE /t/branch-inventory/items/:id
 */
router.delete(
  '/items/:id',
  checkPerms(['inventory.items.manage']),
  async (req, res, next) => {
    try {
      const r = await svc.del(req.tenantDb, req.params.id);
      return res.status(r.status).json(r);
    } catch (e) {
      logger.error(e);
      next(e);
    }
  },
);

module.exports = router;
