'use strict';

const AppError      = require('../../../modules/AppError');
const OrderService  = require('../../order/service/OrderService');

module.exports = async function ensureNormalOrderPrepared(req, res, next) {
  try {
    // Accept orderNo from either :orderNo param or request body
    const orderNo = req.params.orderNo || req.body.orderNo;
    if (!orderNo) throw new AppError('orderNo is required', 422);

    const order = await OrderService.getByOrderNo(orderNo);
    if (!order) throw new AppError('Order not found', 404);

    // Only enforce for NORMAL orders right now (you said Royal Box later)
    if (!order.isRoyalBox) {
      const curr = String(order.currentStatus || '').toUpperCase();
      if (curr !== 'PREPARED') {
        // 409 = Conflict (cleaner than 400 here)
        throw new AppError(
          'Label can be generated only after the order is PREPARED (normal orders).',
          409
        );
      }
    }

    // For Royal Box, we let it pass for now; we’ll enforce later.
    return next();
  } catch (err) {
    next(err);
  }
};
