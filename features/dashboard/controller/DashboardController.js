const express = require('express');
const router = express.Router();
const allow = require('../../../middlewares/rolecheck.middleware');
const logger = require('../../../modules/logger');
const svc = require('../services/DashboardService');

const checkRoles = require('../../../middlewares/checkRoles');

router.use(checkRoles(['superadmin']));

router.get('/summary', async (req,res,next)=>{
  try { const r = await svc.summary(); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});

module.exports = router;
