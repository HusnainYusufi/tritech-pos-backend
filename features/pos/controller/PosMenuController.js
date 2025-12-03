// features/pos/controller/PosMenuController.js
'use strict';

const express = require('express');
const router = express.Router();

const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const PosMenuService = require('../services/PosMenuService');
const { getPosMenu } = require('../validation/posMenu.validation');

router.use(tenantContext);

router.get('/menu',
  checkPerms(['menu.items.read'], { any: true, branchParam: 'branchId' }),
  validate(getPosMenu, 'query'),
  async (req, res, next) => {
    try {
      const response = await PosMenuService.list(req.tenantDb, req.user, req.query);
      return res.status(response.status).json(response);
    } catch (err) {
      logger.error('GET /t/pos/menu failed', err);
      next(err);
    }
  }
);

module.exports = router;
