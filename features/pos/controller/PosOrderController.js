// features/pos/controller/PosOrderController.js
'use strict';

const express = require('express');
const router = express.Router();

const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const PosOrderService = require('../services/PosOrderService');
const { createOrder } = require('../validation/posOrder.validation');

router.use(tenantContext);

router.post('/orders',
  checkPerms(['pos.orders.manage'], { any: true, branchParam: 'branchId' }),
  validate(createOrder),
  async (req, res, next) => {
    try {
      const response = await PosOrderService.create(
        req.tenantDb,
        req.tenantSlug,
        req.user,
        req.body,
      );
      return res.status(response.status).json(response);
    } catch (err) {
      logger.error('POST /t/pos/orders failed', err);
      next(err);
    }
  }
);

module.exports = router;
