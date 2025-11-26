const express = require('express');
const router = express.Router();
const validate = require('../../../middlewares/validate');
const allow = require('../../../middlewares/rolecheck.middleware');
const logger = require('../../../modules/logger');
const svc = require('../services/CommunicationService');
const { createTemplate, updateTemplate, createAnnouncement, updateAnnouncement } = require('../validation/communication.validation');

const checkRoles = require('../../../middlewares/checkRoles');

router.use(checkRoles(['superadmin']));

// Templates
router.post('/templates', validate(createTemplate), async (req,res,next)=>{
  try { const r = await svc.createTemplate(req.body); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});
router.get('/templates', async (req,res,next)=>{
  try { const r = await svc.listTemplates(req.query); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});
router.get('/templates/:id', async (req,res,next)=>{
  try { const r = await svc.getTemplate(req.params.id); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});
router.put('/templates/:id', validate(updateTemplate), async (req,res,next)=>{
  try { const r = await svc.updateTemplate(req.params.id, req.body); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});
router.delete('/templates/:id', async (req,res,next)=>{
  try { const r = await svc.deleteTemplate(req.params.id); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});

// Announcements
router.post('/announcements', validate(createAnnouncement), async (req,res,next)=>{
  try { const r = await svc.createAnnouncement(req.body); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});
router.get('/announcements', async (req,res,next)=>{
  try { const r = await svc.listAnnouncements(req.query); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});
router.get('/announcements/:id', async (req,res,next)=>{
  try { const r = await svc.getAnnouncement(req.params.id); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});
router.put('/announcements/:id', validate(updateAnnouncement), async (req,res,next)=>{
  try { const r = await svc.updateAnnouncement(req.params.id, req.body); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});
router.delete('/announcements/:id', async (req,res,next)=>{
  try { const r = await svc.deleteAnnouncement(req.params.id); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});

module.exports = router;
