const express = require('express');
const router = express.Router();
const validate = require('../../../middlewares/validate');
const { createPlan, updatePlan } = require('../validation/plan.validation');
const PlanService = require('../services/PlanService');
const allow = require('../../../middlewares/rolecheck.middleware');
const logger = require('../../../modules/logger');
const checkRoles = require('../../../middlewares/checkRoles');

router.use(checkRoles(['superadmin']));
router.post('/', validate(createPlan), async (req,res,next)=>{
  try { const r = await PlanService.create(req.body); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});

router.get('/', async (req,res,next)=>{
  try { const r = await PlanService.list(req.query); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});

router.get('/:id', async (req,res,next)=>{
  try { const r = await PlanService.get(req.params.id); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});

router.put('/:id', validate(updatePlan), async (req,res,next)=>{
  try { const r = await PlanService.update(req.params.id, req.body); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});

router.delete('/:id', async (req,res,next)=>{
  try { const r = await PlanService.del(req.params.id); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});

module.exports = router;
