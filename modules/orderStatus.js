// modules/orderStatus.js
module.exports = {
  OrderStatus: Object.freeze({
    PENDING: 'pending',          // just created cart/order
    CONFIRMED: 'confirmed',      // customer confirmed or cashier placed
    PREPARING: 'preparing',      // KDS started
    READY: 'ready',              // ready for pickup/serve
    SERVED: 'served',            // served to table / handed off
    COMPLETED: 'completed',      // paid and closed
    CANCELLED: 'cancelled',      // voided
    REFUNDED: 'refunded',        // fully refunded
  }),
  KdsState: Object.freeze({
    QUEUED: 'queued',
    IN_PROGRESS: 'in_progress',
    READY: 'ready',
    DONE: 'done',
    CANCELLED: 'cancelled'
  }),
  ServiceType: Object.freeze({
    DINE_IN: 'dine_in',
    TAKEAWAY: 'takeaway',
    DELIVERY: 'delivery'
  }),
  PaymentStatus: Object.freeze({
    PENDING: 'pending',
    AUTHORIZED: 'authorized',
    CAPTURED: 'captured',
    FAILED: 'failed',
    REFUNDED: 'refunded',
    VOIDED: 'voided'
  })
};
