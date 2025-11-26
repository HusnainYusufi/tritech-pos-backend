'use strict';

const express = require('express');
const router = express.Router();
const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const svc = require('../services/recipe.service');
const { createRecipe, updateRecipe } = require('../validation/recipe.validation');

router.use(tenantContext);

// Create
router.post('/',
  checkPerms(['recipes.manage']),
  validate(createRecipe),
  async (req, res, next) => {
    try {
      const r = await svc.create(req.tenantDb, req.body);
      res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

// List
router.get('/',
  checkPerms(['recipes.read'], { any: true }),
  async (req, res, next) => {
    try {
      const r = await svc.list(req.tenantDb, req.query);
      res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

// Get one
router.get('/:id',
  checkPerms(['recipes.read'], { any: true }),
  async (req, res, next) => {
    try {
      const r = await svc.get(req.tenantDb, req.params.id);
      res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

// Update
router.put('/:id',
  checkPerms(['recipes.manage']),
  validate(updateRecipe),
  async (req, res, next) => {
    try {
      const r = await svc.update(req.tenantDb, req.params.id, req.body);
      res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

// Delete
router.delete('/:id',
  checkPerms(['recipes.manage']),
  async (req, res, next) => {
    try {
      const r = await svc.del(req.tenantDb, req.params.id);
      res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * NEW: Get a recipe together with its variants (by ID)
 * GET /t/recipes/:id/with-variants?activeOnly=true&page=1&limit=50&sort=createdAt&order=desc
 */
router.get('/:id/with-variants',
  checkPerms(['recipes.read'], { any: true }),
  async (req, res, next) => {
    try {
      const r = await svc.getWithVariantsById(req.tenantDb, req.params.id, req.query);
      res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

/**
 * NEW: Get a recipe together with its variants (by slug)
 * GET /t/recipes/by-slug/:slug/with-variants?activeOnly=true&page=1&limit=50
 */
router.get('/by-slug/:slug/with-variants',
  checkPerms(['recipes.read'], { any: true }),
  async (req, res, next) => {
    try {
      const r = await svc.getWithVariantsBySlug(req.tenantDb, req.params.slug, req.query);
      res.status(r.status).json(r);
    } catch (e) { logger.error(e); next(e); }
  }
);

module.exports = router;
