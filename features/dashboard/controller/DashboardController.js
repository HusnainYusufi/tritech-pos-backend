const express = require('express');
const router = express.Router();
const allow = require('../../../middlewares/rolecheck.middleware');
const logger = require('../../../modules/logger');
const svc = require('../services/DashboardService');

const checkRoles = require('../../../middlewares/checkRoles');

router.use(checkRoles(['superadmin']));

/**
 * @swagger
 * /admin/dashboard/summary:
 *   get:
 *     tags:
 *       - Dashboard
 *     summary: Get dashboard summary
 *     description: Retrieve overall system statistics and metrics (superadmin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard summary retrieved successfully
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
 *                   example: Summary retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalTenants:
 *                       type: integer
 *                       example: 150
 *                     activeTenants:
 *                       type: integer
 *                       example: 142
 *                     totalRevenue:
 *                       type: number
 *                       example: 45000.00
 *                     monthlyRevenue:
 *                       type: number
 *                       example: 12500.00
 *                     totalUsers:
 *                       type: integer
 *                       example: 3500
 *                     recentActivity:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/summary', async (req,res,next)=>{
  try { const r = await svc.summary(); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});

module.exports = router;
