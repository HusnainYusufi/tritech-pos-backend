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
 * @swagger
 * /t/pos/orders:
 *   post:
 *     tags:
 *       - POS Orders
 *     summary: Create POS order
 *     description: |
 *       Create a new POS order with automatic:
 *       - Order number generation
 *       - Inventory deduction
 *       - Payment processing
 *       - Till session linking
 *       - Optional receipt generation
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: printReceipt
 *         in: query
 *         schema:
 *           type: boolean
 *         description: Auto-generate receipt with order
 *       - name: receiptFormat
 *         in: query
 *         schema:
 *           type: string
 *           enum: [html, text, thermal]
 *           default: html
 *         description: Receipt format
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - branchId
 *               - items
 *               - paymentMethod
 *             properties:
 *               branchId:
 *                 type: string
 *                 example: branch_1234567890
 *               tillSessionId:
 *                 type: string
 *                 example: session_1234567890
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - menuItemId
 *                     - quantity
 *                     - price
 *                   properties:
 *                     menuItemId:
 *                       type: string
 *                       example: item_1234567890
 *                     quantity:
 *                       type: number
 *                       example: 2
 *                     price:
 *                       type: number
 *                       example: 12.99
 *                     variations:
 *                       type: array
 *                       items:
 *                         type: object
 *                     notes:
 *                       type: string
 *                       example: No onions
 *               subtotal:
 *                 type: number
 *                 example: 25.98
 *               tax:
 *                 type: number
 *                 example: 2.60
 *               discount:
 *                 type: number
 *                 example: 0
 *               total:
 *                 type: number
 *                 example: 28.58
 *               paymentMethod:
 *                 type: string
 *                 enum: [cash, card, digital]
 *                 example: card
 *               customerName:
 *                 type: string
 *                 example: John Doe
 *               customerPhone:
 *                 type: string
 *                 example: +1234567890
 *     responses:
 *       201:
 *         description: Order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 201
 *                 message:
 *                   type: string
 *                   example: Order created successfully
 *                 result:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     orderNumber:
 *                       type: string
 *                       example: ORD-001
 *                     total:
 *                       type: number
 *                     receipt:
 *                       type: object
 *                       description: Included if printReceipt=true
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
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
 * @swagger
 * /t/pos/orders/{id}/receipt:
 *   get:
 *     tags:
 *       - POS Orders
 *     summary: Get order receipt
 *     description: Generate and retrieve receipt for an order
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *       - name: format
 *         in: query
 *         schema:
 *           type: string
 *           enum: [html, text, thermal]
 *           default: html
 *         description: Receipt format
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Receipt generated successfully
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *           text/plain:
 *             schema:
 *               type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
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
 * @swagger
 * /t/pos/orders:
 *   get:
 *     tags:
 *       - POS Orders
 *     summary: Get all orders
 *     description: Retrieve list of POS orders with filtering and pagination
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - name: branchId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by branch
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [placed, paid, void, refunded]
 *         description: Filter by status
 *       - name: staffId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by staff member
 *       - name: tillSessionId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by till session
 *       - name: startDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter from date
 *       - name: endDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter to date
 *       - name: sort
 *         in: query
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Sort field
 *       - name: order
 *         in: query
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: OK
 *                 result:
 *                   type: object
 *                   properties:
 *                     orders:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/PosOrder'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
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

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

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
 * @swagger
 * /t/pos/orders/{id}:
 *   get:
 *     tags:
 *       - POS Orders
 *     summary: Get order by ID
 *     description: Retrieve detailed information about a specific order
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Order retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: OK
 *                 result:
 *                   $ref: '#/components/schemas/PosOrder'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
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
 * @swagger
 * /t/pos/orders/{id}/print:
 *   post:
 *     tags:
 *       - POS Orders
 *     summary: Print order receipt
 *     description: Generate receipt for printing (supports thermal printers)
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               format:
 *                 type: string
 *                 enum: [html, text, thermal]
 *                 default: html
 *               autoPrint:
 *                 type: boolean
 *                 description: For thermal printers
 *     responses:
 *       200:
 *         description: Receipt generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: Receipt generated successfully
 *                 result:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
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
