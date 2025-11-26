// features/staff/controller/StaffController.js
'use strict';

const express = require('express');
const router = express.Router();

const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const StaffService = require('../services/StaffService');
const { createStaff, updateStaff, listStaff, updatePin, updateStatus } = require('../validation/staff.validation');

const branchContext = (req) => req.params?.branchId || req.body?.branchId || req.query?.branchId || req.header('x-branch-id') || null;

router.use(tenantContext);

// Create staff
router.post('/',
  checkPerms(['staff.manage'], { any: true, branchParam: 'branchId' }),
  validate(createStaff),
  async (req, res, next) => {
    try {
      const r = await StaffService.create(req.tenantDb, req.user?.uid, req.body, branchContext(req));
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

// List staff
router.get('/',
  checkPerms(['staff.read'], { any: true, branchParam: 'branchId' }),
  validate(listStaff, 'query'),
  async (req, res, next) => {
    try {
      const r = await StaffService.list(req.tenantDb, req.user?.uid, req.query, branchContext(req));
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

// Get staff by id
router.get('/:id',
  checkPerms(['staff.read'], { any: true, branchParam: 'branchId' }),
  async (req, res, next) => {
    try {
      const r = await StaffService.get(req.tenantDb, req.user?.uid, req.params.id, branchContext(req));
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

// Update staff
router.put('/:id',
  checkPerms(['staff.manage'], { any: true, branchParam: 'branchId' }),
  validate(updateStaff),
  async (req, res, next) => {
    try {
      const r = await StaffService.update(req.tenantDb, req.user?.uid, req.params.id, req.body, branchContext(req));
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

// Update PIN
router.post('/:id/set-pin',
  checkPerms(['staff.manage'], { any: true, branchParam: 'branchId' }),
  validate(updatePin),
  async (req, res, next) => {
    try {
      const r = await StaffService.setPin(req.tenantDb, req.user?.uid, req.params.id, req.body, branchContext(req));
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

// Update status
router.post('/:id/status',
  checkPerms(['staff.manage'], { any: true, branchParam: 'branchId' }),
  validate(updateStatus),
  async (req, res, next) => {
    try {
      const r = await StaffService.setStatus(req.tenantDb, req.user?.uid, req.params.id, req.body, branchContext(req));
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

module.exports = router;
