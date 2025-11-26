'use strict';

const express = require('express');
const router = express.Router();

const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const svc = require('../services/branchMenu.service');

const {
  createBranchMenuConfig,
  updateBranchMenuConfig,
  listBranchMenuConfig,
  listEffectiveBranchMenu,
} = require('../validation/branchMenu.validation');

// Inject tenant
router.use(tenantContext);

// -----------------------------------------------
// EFFECTIVE BRANCH MENU
// -----------------------------------------------
router.get(
  '/effective',
  checkPerms(['menu.items.read'], { any: true, branchQuery: 'branchId' }),
  async (req, res, next) => {
    try {
      const { tenantDb } = req;
      const response = await svc.listEffective(tenantDb, req.query);
      return res.status(response.status).json(response);
    } catch (err) {
      logger.error('GET /t/branch-menu/effective failed', err);
      next(err);
    }
  }
);

// -----------------------------------------------
// RAW CONFIG LIST
// -----------------------------------------------
router.get(
  '/',
  checkPerms(['menu.items.read'], { any: true, branchQuery: 'branchId' }),
  validate(listBranchMenuConfig),
  async (req, res, next) => {
    try {
      const { tenantDb } = req;
      const response = await svc.list(tenantDb, req.query);
      return res.status(response.status).json(response);
    } catch (err) {
      logger.error('GET /t/branch-menu failed', err);
      next(err);
    }
  }
);

// CREATE CONFIG
router.post(
  '/',
  checkPerms(['menu.items.manage'], { branchBody: 'branchId' }),
  validate(createBranchMenuConfig),
  async (req, res, next) => {
    try {
      const conn = req.tenantDb || req.tenantConnection;
      const response = await svc.upsert(conn, req.body);
      return res.status(response.status).json(response);
    } catch (err) {
      logger.error('POST /t/branch-menu failed', err);
      next(err);
    }
  }
);

// UPDATE CONFIG
router.put(
  '/:id',
  checkPerms(['menu.items.manage']),
  validate(updateBranchMenuConfig),
  async (req, res, next) => {
    try {
      const conn = req.tenantDb || req.tenantConnection;
      const response = await svc.updateById(conn, req.params.id, req.body);
      return res.status(response.status).json(response);
    } catch (err) {
      logger.error('PUT /t/branch-menu/:id failed', err);
      next(err);
    }
  }
);


// -----------------------------------------------
// DELETE CONFIG
// -----------------------------------------------
router.delete(
  '/:id',
  checkPerms(['menu.items.manage']),
  async (req, res, next) => {
    try {
      const { tenantDb } = req;

      const response = await svc.delete(tenantDb, req.params.id);
      return res.status(response.status).json(response);
    } catch (err) {
      logger.error('DELETE /t/branch-menu/:id failed', err);
      next(err);
    }
  }
);

module.exports = router;
