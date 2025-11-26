// features/tenant-rbac/controller/TenantRoleController.js
'use strict';

const express = require('express');
const router = express.Router();

const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const logger = require('../../../modules/logger');

const RoleRepo = require('../repository/tenantRole.repository');

router.use(tenantContext);

// List roles
router.get('/roles',
  checkPerms(['rbac.roles:read'], { any: true }),
  async (req, res, next) => {
    try {
      const Role = RoleRepo.model(req.tenantDb);
      const roles = await Role.find({}).sort({ createdAt: -1 }).lean();
      res.json({ status: 200, items: roles });
    } catch (e) { logger.error(e); next(e); }
  }
);

// (Optional) create role
router.post('/roles',
  checkPerms(['rbac.roles:manage']),
  async (req, res, next) => {
    try {
      const { key, permissions = [], scope = 'tenant' } = req.body;
      const Role = RoleRepo.model(req.tenantDb);
      const exists = await Role.findOne({ key });
      if (exists) return res.status(409).json({ status:409, message:'Role key already exists' });
      const doc = await Role.create({ key, permissions, scope });
      res.json({ status: 200, message:'Role created', result: doc });
    } catch (e) { logger.error(e); next(e); }
  }
);

module.exports = router;
