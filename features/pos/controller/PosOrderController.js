// features/pos/controller/PosOrderController.js
'use strict';

const express = require('express');
const router = express.Router();

const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const PosOrderService = require('../services/PosOrderService');
const ReceiptService = require('../services/ReceiptService');
const { createOrder } = require('../validation/posOrder.validation');

router.use(tenantContext);

/**
 * Create POS Order
 * POST /t/pos/orders
 * 
 * Creates a new POS order with automatic:
 * - Order number generation
 * - Inventory deduction
 * - Payment processing
 * - Till session linking
 * - Optional receipt generation
 * 
 * Query params:
 * - printReceipt=true: Returns receipt data with order
 * - receiptFormat=html|text|thermal: Receipt format (default: html)
 */
router.post('/orders',
  checkPerms(['pos.orders.create', 'pos.orders.manage'], { any: true, branchParam: 'branchId' }),
  validate(createOrder),
  async (req, res, next) => {
    try {
      const response = await PosOrderService.create(
        req.tenantDb,
        req.tenantSlug,
        req.user,
        req.body,
      );

      // Auto-generate receipt if requested
      if (req.query.printReceipt === 'true') {
        try {
          const receiptFormat = req.query.receiptFormat || 'html';
          const receipt = await ReceiptService.generateReceipt(
            req.tenantDb,
            response.result.id,
            receiptFormat
          );
          response.result.receipt = receipt;
        } catch (receiptErr) {
          logger.error('Receipt generation failed', receiptErr);
          // Don't fail the order, just log the error
        }
      }

      return res.status(response.status).json(response);
    } catch (err) {
      logger.error('POST /t/pos/orders failed', err);
      next(err);
    }
  }
);

/**
 * Get Order Receipt
 * GET /t/pos/orders/:id/receipt?format=html|text|thermal
 * 
 * Generates receipt for an order in specified format
 */
router.get('/orders/:id/receipt',
  checkPerms(['pos.orders.read', 'pos.orders.manage'], { any: true }),
  async (req, res, next) => {
    try {
      const format = req.query.format || 'html';
      const receipt = await ReceiptService.generateReceipt(
        req.tenantDb,
        req.params.id,
        format
      );

      if (format === 'html') {
        res.setHeader('Content-Type', 'text/html');
        return res.send(receipt.content);
      } else {
        res.setHeader('Content-Type', 'text/plain');
        return res.send(receipt.content);
      }
    } catch (err) {
      logger.error('GET /t/pos/orders/:id/receipt failed', err);
      next(err);
    }
  }
);

/**
 * List Orders
 * GET /t/pos/orders
 * 
 * Query params:
 * - branchId: Filter by branch
 * - status: Filter by status (placed|paid|void|refunded)
 * - staffId: Filter by staff member
 * - tillSessionId: Filter by till session
 * - startDate: Filter from date (ISO format)
 * - endDate: Filter to date (ISO format)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - sort: Sort field (default: createdAt)
 * - order: Sort order (asc|desc, default: desc)
 */
router.get('/orders',
  checkPerms(['pos.orders.read', 'pos.orders.manage'], { any: true, branchParam: 'branchId' }),
  async (req, res, next) => {
    try {
      const {
        branchId,
        status,
        staffId,
        tillSessionId,
        startDate,
        endDate,
        page = 1,
        limit = 20,
        sort = 'createdAt',
        order = 'desc'
      } = req.query;

      const PosOrder = require('../repository/posOrder.repository').model(req.tenantDb);
      
      // Build filter
      const filter = {};
      if (branchId) filter.branchId = branchId;
      if (status) filter.status = status;
      if (staffId) filter.staffId = staffId;
      if (tillSessionId) filter.tillSessionId = tillSessionId;
      
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }

      // Pagination
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      // Execute query
      const [orders, total] = await Promise.all([
        PosOrder.find(filter)
          .populate('branchId', 'name code')
          .populate('staffId', 'fullName email')
          .sort({ [sort]: order === 'asc' ? 1 : -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        PosOrder.countDocuments(filter)
      ]);

      return res.status(200).json({
        status: 200,
        message: 'OK',
        result: {
          orders,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum)
          }
        }
      });
    } catch (err) {
      logger.error('GET /t/pos/orders failed', err);
      next(err);
    }
  }
);

/**
 * Get Order Details
 * GET /t/pos/orders/:id
 */
router.get('/orders/:id',
  checkPerms(['pos.orders.read', 'pos.orders.manage'], { any: true }),
  async (req, res, next) => {
    try {
      const PosOrder = require('../repository/posOrder.repository').model(req.tenantDb);
      const order = await PosOrder.findById(req.params.id)
        .populate('branchId', 'name code address contact tax posConfig')
        .populate('staffId', 'fullName email')
        .populate('posId', 'name code')
        .lean();

      if (!order) {
        return res.status(404).json({
          status: 404,
          message: 'Order not found'
        });
      }

      return res.status(200).json({
        status: 200,
        message: 'OK',
        result: order
      });
    } catch (err) {
      logger.error('GET /t/pos/orders/:id failed', err);
      next(err);
    }
  }
);

/**
 * Print Receipt
 * POST /t/pos/orders/:id/print
 * 
 * Body:
 * - format: html|text|thermal (default: html)
 * - autoPrint: boolean (for thermal printers)
 */
router.post('/orders/:id/print',
  checkPerms(['pos.orders.read', 'pos.orders.manage'], { any: true }),
  async (req, res, next) => {
    try {
      const format = req.body.format || 'html';
      const receipt = await ReceiptService.generateReceipt(
        req.tenantDb,
        req.params.id,
        format
      );

      logger.info('[PosOrderController] Receipt printed', {
        orderId: req.params.id,
        format,
        staffId: req.user?.uid
      });

      return res.status(200).json({
        status: 200,
        message: 'Receipt generated successfully',
        result: receipt
      });
    } catch (err) {
      logger.error('POST /t/pos/orders/:id/print failed', err);
      next(err);
    }
  }
);

module.exports = router;
