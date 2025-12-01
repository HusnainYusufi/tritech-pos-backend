// features/pos/controller/PosTillController.js
'use strict';

const express = require('express');
const router = express.Router();

const tenantContext = require('../../../middlewares/tenantContext');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const PosTillService = require('../services/PosTillService');
const { openTill, closeTill } = require('../validation/posTill.validation');

router.use(tenantContext);

router.post('/till/open', validate(openTill), async (req, res, next) => {
  try {
    const r = await PosTillService.openTill(req.tenantDb, req.user, req.body);
    return res.status(r.status).json(r);
  } catch (e) { logger.error(e); next(e); }
});

router.post('/till/close', validate(closeTill), async (req, res, next) => {
  try {
    const r = await PosTillService.closeTill(req.tenantDb, req.user, req.body);
    return res.status(r.status).json(r);
  } catch (e) { logger.error(e); next(e); }
});

module.exports = router;
