// features/pos/controller/PosTerminalController.js
'use strict';

const express = require('express');
const router = express.Router();

const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const PosTerminalService = require('../services/PosTerminalService');
const { createTerminal, listTerminals, updateTerminal } = require('../validation/posTerminal.validation');

router.use(tenantContext);

router.post('/terminals',
  checkPerms(['pos.manage']),
  validate(createTerminal),
  async (req, res, next) => {
    try {
      const r = await PosTerminalService.create(req.tenantDb, req.user, req.body);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

router.get('/terminals',
  checkPerms(['pos.read'], { any: true }),
  validate(listTerminals, 'query'),
  async (req, res, next) => {
    try {
      const r = await PosTerminalService.list(req.tenantDb, req.user, req.query);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

router.put('/terminals/:id',
  checkPerms(['pos.manage']),
  validate(updateTerminal),
  async (req, res, next) => {
    try {
      const r = await PosTerminalService.update(req.tenantDb, req.user, req.params.id, req.body);
      return res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

module.exports = router;
