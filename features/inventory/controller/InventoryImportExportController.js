'use strict';

const express = require('express');
const router = express.Router();

const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const upload = require('../../../middlewares/uploadCsv.middleware');

const logger = require('../../../modules/logger');
const AppError = require('../../../modules/AppError');
const { importOptions } = require('../validation/importExport.validation');
const svc = require('../services/ImportExportService');

router.use(tenantContext);

/**
 * @swagger
 * /t/inventory/items/import/template:
 *   get:
 *     tags:
 *       - Inventory Import/Export
 *     summary: Download import template
 *     description: |
 *       Download a CSV template for bulk importing inventory items.
 *       Optionally include a sample row to understand the format.
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: sample
 *         in: query
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include sample data row
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: CSV template downloaded successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               example: |
 *                 name,sku,category,unit,reorderPoint,quantity,price
 *                 Tomatoes,TOM-001,Vegetables,kg,10,50,2.50
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/items/import/template',
  checkPerms(['inventory.*','inventory.manage','menu.*'], { any: true }),
  async (req, res, next) => {
    try {
      const withSample = String(req.query.sample || '').toLowerCase() === 'true';
      const csv = await svc.exportTemplateCsv(req.tenantDb, req.tenant, withSample);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="inventory_items_template.csv"');
      res.status(200).send(csv);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/inventory/items/export:
 *   get:
 *     tags:
 *       - Inventory Import/Export
 *     summary: Export inventory items
 *     description: |
 *       Export all inventory items to CSV format for:
 *       - Backup purposes
 *       - Data analysis
 *       - Bulk editing (re-import after modifications)
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: q
 *         in: query
 *         schema:
 *           type: string
 *         description: Search filter
 *       - name: categoryId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by category
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: CSV export generated successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/items/export',
  checkPerms(['inventory.*','inventory.read'], { any: true }),
  async (req, res, next) => {
    try {
      const csv = await svc.exportItemsCsv(req.tenantDb, {
        q: req.query.q || '',
        categoryId: req.query.categoryId || null
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="inventory_items_export.csv"');
      res.status(200).send(csv);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/inventory/items/import:
 *   post:
 *     tags:
 *       - Inventory Import/Export
 *     summary: Import inventory items
 *     description: |
 *       Bulk import inventory items from CSV or Excel file.
 *       
 *       **Import Options:**
 *       - `autoCreateCategories`: Automatically create missing categories
 *       - `duplicatePolicy`: How to handle existing items
 *         - `skip`: Skip duplicate items
 *         - `update`: Update existing items with new data
 *       
 *       **Process:**
 *       1. Upload CSV/XLSX file
 *       2. System validates all rows
 *       3. Creates/updates items based on policy
 *       4. Returns detailed report with success/error counts
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV or XLSX file
 *               options:
 *                 type: string
 *                 description: JSON string with import options
 *                 example: '{"autoCreateCategories":true,"duplicatePolicy":"update"}'
 *     responses:
 *       200:
 *         description: Import processed successfully
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
 *                   example: Import processed
 *                 result:
 *                   type: object
 *                   properties:
 *                     totalRows:
 *                       type: integer
 *                       example: 100
 *                     successCount:
 *                       type: integer
 *                       example: 95
 *                     errorCount:
 *                       type: integer
 *                       example: 5
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           row:
 *                             type: integer
 *                           error:
 *                             type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/items/import',
  checkPerms(['inventory.*','inventory.manage']),
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) throw new AppError('file is required', 400);

      let opts = {};
      if (req.body?.options) {
        try { opts = JSON.parse(req.body.options); } catch { /* ignore */ }
      }
      opts = await importOptions.validateAsync(opts);

      const { report } = await svc.importItems(req.tenantDb, req.tenant, req.file, opts);
      res.status(200).json({ status: 200, message: 'Import processed', result: report });
    } catch (e) { logger.error(e); next(e); }
  }
);

module.exports = router;
