const express = require('express');
const router = express.Router();
const validate = require('../../../middlewares/validate');
const { createPlan, updatePlan } = require('../validation/plan.validation');
const PlanService = require('../services/PlanService');
const allow = require('../../../middlewares/rolecheck.middleware');
const logger = require('../../../modules/logger');
const checkRoles = require('../../../middlewares/checkRoles');

router.use(checkRoles(['superadmin']));

/**
 * @swagger
 * /admin/plans:
 *   post:
 *     tags:
 *       - Plans
 *     summary: Create a new subscription plan
 *     description: Create a new subscription plan for tenants (superadmin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *             properties:
 *               name:
 *                 type: string
 *                 example: Premium Plan
 *               description:
 *                 type: string
 *                 example: Full-featured plan with unlimited users
 *               price:
 *                 type: number
 *                 example: 99.99
 *               currency:
 *                 type: string
 *                 example: USD
 *               interval:
 *                 type: string
 *                 enum: [monthly, yearly]
 *                 example: monthly
 *               features:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["unlimited_users", "advanced_reporting", "api_access"]
 *               limits:
 *                 type: object
 *                 properties:
 *                   branches:
 *                     type: number
 *                     example: 10
 *                   users:
 *                     type: number
 *                     example: 100
 *     responses:
 *       201:
 *         description: Plan created successfully
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
 *                   example: Plan created successfully
 *                 data:
 *                   type: object
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/', validate(createPlan), async (req,res,next)=>{
  try { const r = await PlanService.create(req.body); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});

/**
 * @swagger
 * /admin/plans:
 *   get:
 *     tags:
 *       - Plans
 *     summary: Get all subscription plans
 *     description: Retrieve a list of all subscription plans (superadmin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - name: active
 *         in: query
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Plans retrieved successfully
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
 *                   example: Plans retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', async (req,res,next)=>{
  try { const r = await PlanService.list(req.query); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});

/**
 * @swagger
 * /admin/plans/{id}:
 *   get:
 *     tags:
 *       - Plans
 *     summary: Get plan by ID
 *     description: Retrieve detailed information about a specific plan (superadmin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Plan ID
 *     responses:
 *       200:
 *         description: Plan retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 data:
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
router.get('/:id', async (req,res,next)=>{
  try { const r = await PlanService.get(req.params.id); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});

/**
 * @swagger
 * /admin/plans/{id}:
 *   put:
 *     tags:
 *       - Plans
 *     summary: Update plan
 *     description: Update subscription plan details (superadmin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Plan ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               features:
 *                 type: array
 *                 items:
 *                   type: string
 *               active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Plan updated successfully
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
 *                   example: Plan updated successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put('/:id', validate(updatePlan), async (req,res,next)=>{
  try { const r = await PlanService.update(req.params.id, req.body); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});

/**
 * @swagger
 * /admin/plans/{id}:
 *   delete:
 *     tags:
 *       - Plans
 *     summary: Delete plan
 *     description: Delete a subscription plan (superadmin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Plan ID
 *     responses:
 *       200:
 *         description: Plan deleted successfully
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
 *                   example: Plan deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/:id', async (req,res,next)=>{
  try { const r = await PlanService.del(req.params.id); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});

module.exports = router;
