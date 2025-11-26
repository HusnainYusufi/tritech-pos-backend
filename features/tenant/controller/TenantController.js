const express = require('express');
const router = express.Router();
const validate = require('../../../middlewares/validate');
const { createTenant, updateTenant } = require('../validation/tenant.validation');
const TenantService = require('../services/TenantService');
const allow = require('../../../middlewares/rolecheck.middleware');
const upload = require('../../../middlewares/upload.middleware');
const logger = require('../../../modules/logger');
const checkRoles = require('../../../middlewares/checkRoles');

router.use(checkRoles(['superadmin']));

router.post('/', validate(createTenant), async (req, res, next) => {
  try { const r = await TenantService.create(req.body); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

router.get('/', async (req, res, next) => {
  try { const r = await TenantService.list(req.query); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

router.get('/:id', async (req, res, next) => {
  try { const r = await TenantService.get(req.params.id); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

router.put('/:id', validate(updateTenant), async (req, res, next) => {
  try { const r = await TenantService.update(req.params.id, req.body); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try { const r = await TenantService.del(req.params.id); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

router.post('/:id/change-plan', async (req, res, next) => {
  try { const { planId } = req.body; const r = await TenantService.changePlan(req.params.id, planId); return res.status(r.status).json(r); }
  catch (e) { logger.error(e); next(e); }
});

router.post('/:id/logo', upload.single('file'), async (req, res, next) => {
  try {
    const fileUrl = `/uploads/${req.file.filename}`; // swap to S3 later
    const r = await TenantService.update(req.params.id, { logoUrl: fileUrl });
    return res.status(r.status).json(r);
  } catch (e) { logger.error(e); next(e); }
});

module.exports = router;
