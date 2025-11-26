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
 * GET /t/inventory/items/import/template
 * ?sample=true - include one sample row
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
 * GET /t/inventory/items/export
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
 * POST /t/inventory/items/import
 * Form-Data: file=<csv/xlsx>, options JSON in "options" (optional)
 * options: { autoCreateCategories?: boolean, duplicatePolicy?: 'skip'|'update' }
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
