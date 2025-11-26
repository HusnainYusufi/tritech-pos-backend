'use strict';
const express = require('express');
const router = express.Router();

const tenantContext = require('../../../middlewares/tenantContext');
const checkPerms = require('../../../middlewares/tenantCheckPermissions');
const validate = require('../../../middlewares/validate');
const logger = require('../../../modules/logger');

const svc = require('../services/addons.service');
const { createGroup, updateGroup, createItem, updateItem, bulkCreateItems } = require('../validation/addons.validation');

router.use(tenantContext);

// -------- GROUPS --------
router.post('/groups',
  checkPerms(['menu.addons.manage']),
  validate(createGroup),
  async (req,res,next)=>{
    try { const r = await svc.createGroup(req.tenantDb, req.body); res.status(r.status).json(r); }
    catch(e){ logger.error(e); next(e); }
  }
);

router.get('/groups',
  checkPerms(['menu.addons.read'], { any: true }),
  async (req,res,next)=>{
    try { const r = await svc.listGroups(req.tenantDb, req.query); res.status(r.status).json(r); }
    catch(e){ logger.error(e); next(e); }
  }
);

router.get('/groups/:id',
  checkPerms(['menu.addons.read'], { any: true }),
  async (req,res,next)=>{
    try { const r = await svc.getGroup(req.tenantDb, req.params.id); res.status(r.status).json(r); }
    catch(e){ logger.error(e); next(e); }
  }
);

router.put('/groups/:id',
  checkPerms(['menu.addons.manage']),
  validate(updateGroup),
  async (req,res,next)=>{
    try { const r = await svc.updateGroup(req.tenantDb, req.params.id, req.body); res.status(r.status).json(r); }
    catch(e){ logger.error(e); next(e); }
  }
);

router.delete('/groups/:id',
  checkPerms(['menu.addons.manage']),
  async (req,res,next)=>{
    try { const r = await svc.deleteGroup(req.tenantDb, req.params.id); res.status(r.status).json(r); }
    catch(e){ logger.error(e); next(e); }
  }
);

// -------- ITEMS --------
router.post('/items',
  checkPerms(['menu.addons.manage']),
  validate(createItem),
  async (req,res,next)=>{
    try { const r = await svc.createItem(req.tenantDb, req.body); res.status(r.status).json(r); }
    catch(e){ logger.error(e); next(e); }
  }
);

router.post('/items/bulk',
  checkPerms(['menu.addons.manage']),
  validate(bulkCreateItems),
  async (req,res,next)=>{
    try { const r = await svc.bulkCreateItems(req.tenantDb, req.body); res.status(r.status).json(r); }
    catch(e){ logger.error(e); next(e); }
  }
);

router.get('/items',
  checkPerms(['menu.addons.read'], { any: true }),
  async (req,res,next)=>{
    try { const r = await svc.listItems(req.tenantDb, req.query); res.status(r.status).json(r); }
    catch(e){ logger.error(e); next(e); }
  }
);

router.get('/items/:id',
  checkPerms(['menu.addons.read'], { any: true }),
  async (req,res,next)=>{
    try { const r = await svc.getItem(req.tenantDb, req.params.id); res.status(r.status).json(r); }
    catch(e){ logger.error(e); next(e); }
  }
);

router.put('/items/:id',
  checkPerms(['menu.addons.manage']),
  validate(updateItem),
  async (req,res,next)=>{
    try { const r = await svc.updateItem(req.tenantDb, req.params.id, req.body); res.status(r.status).json(r); }
    catch(e){ logger.error(e); next(e); }
  }
);

router.delete('/items/:id',
  checkPerms(['menu.addons.manage']),
  async (req,res,next)=>{
    try { const r = await svc.deleteItem(req.tenantDb, req.params.id); res.status(r.status).json(r); }
    catch(e){ logger.error(e); next(e); }
  }
);

// -------- POS CONFIG --------
router.get('/config/by-category/:categoryId',
  checkPerms(['menu.addons.read'], { any: true }),
  async (req,res,next)=>{
    try { const r = await svc.getConfigByCategory(req.tenantDb, req.params.categoryId); res.status(r.status).json(r); }
    catch(e){ logger.error(e); next(e); }
  }
);

module.exports = router;
