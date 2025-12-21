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

/**
 * @swagger
 * /admin/comms/templates:
 *   post:
 *     tags:
 *       - Communications
 *     summary: Create communication template
 *     description: Create a new email/SMS template (superadmin only)
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
 *               - type
 *               - subject
 *               - body
 *             properties:
 *               name:
 *                 type: string
 *                 example: Welcome Email
 *               type:
 *                 type: string
 *                 enum: [email, sms]
 *                 example: email
 *               subject:
 *                 type: string
 *                 example: Welcome to Our Platform
 *               body:
 *                 type: string
 *                 example: Hello {{name}}, welcome to our platform!
 *               variables:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["name", "email"]
 *     responses:
 *       201:
 *         description: Template created successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/templates', validate(createTemplate), async (req,res,next)=>{
  try { const r = await svc.createTemplate(req.body); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});

/**
 * @swagger
 * /admin/comms/templates:
 *   get:
 *     tags:
 *       - Communications
 *     summary: Get all templates
 *     description: Retrieve list of all communication templates (superadmin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *       - name: type
 *         in: query
 *         schema:
 *           type: string
 *           enum: [email, sms]
 *         description: Filter by template type
 *     responses:
 *       200:
 *         description: Templates retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/templates', async (req,res,next)=>{
  try { const r = await svc.listTemplates(req.query); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});

/**
 * @swagger
 * /admin/comms/templates/{id}:
 *   get:
 *     tags:
 *       - Communications
 *     summary: Get template by ID
 *     description: Retrieve a specific template (superadmin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Template retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/templates/:id', async (req,res,next)=>{
  try { const r = await svc.getTemplate(req.params.id); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});

/**
 * @swagger
 * /admin/comms/templates/{id}:
 *   put:
 *     tags:
 *       - Communications
 *     summary: Update template
 *     description: Update communication template (superadmin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               subject:
 *                 type: string
 *               body:
 *                 type: string
 *     responses:
 *       200:
 *         description: Template updated successfully
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
router.put('/templates/:id', validate(updateTemplate), async (req,res,next)=>{
  try { const r = await svc.updateTemplate(req.params.id, req.body); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});

/**
 * @swagger
 * /admin/comms/templates/{id}:
 *   delete:
 *     tags:
 *       - Communications
 *     summary: Delete template
 *     description: Delete a communication template (superadmin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Template deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/templates/:id', async (req,res,next)=>{
  try { const r = await svc.deleteTemplate(req.params.id); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});

// Announcements

/**
 * @swagger
 * /admin/comms/announcements:
 *   post:
 *     tags:
 *       - Communications
 *     summary: Create announcement
 *     description: Create a new system announcement (superadmin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - message
 *             properties:
 *               title:
 *                 type: string
 *                 example: System Maintenance
 *               message:
 *                 type: string
 *                 example: System will be down for maintenance on Sunday
 *               type:
 *                 type: string
 *                 enum: [info, warning, critical]
 *                 example: warning
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Announcement created successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/announcements', validate(createAnnouncement), async (req,res,next)=>{
  try { const r = await svc.createAnnouncement(req.body); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});

/**
 * @swagger
 * /admin/comms/announcements:
 *   get:
 *     tags:
 *       - Communications
 *     summary: Get all announcements
 *     description: Retrieve list of all announcements (superadmin only)
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
 *         description: Announcements retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/announcements', async (req,res,next)=>{
  try { const r = await svc.listAnnouncements(req.query); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});

/**
 * @swagger
 * /admin/comms/announcements/{id}:
 *   get:
 *     tags:
 *       - Communications
 *     summary: Get announcement by ID
 *     description: Retrieve a specific announcement (superadmin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Announcement retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/announcements/:id', async (req,res,next)=>{
  try { const r = await svc.getAnnouncement(req.params.id); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});

/**
 * @swagger
 * /admin/comms/announcements/{id}:
 *   put:
 *     tags:
 *       - Communications
 *     summary: Update announcement
 *     description: Update an announcement (superadmin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               message:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [info, warning, critical]
 *     responses:
 *       200:
 *         description: Announcement updated successfully
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
router.put('/announcements/:id', validate(updateAnnouncement), async (req,res,next)=>{
  try { const r = await svc.updateAnnouncement(req.params.id, req.body); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});

/**
 * @swagger
 * /admin/comms/announcements/{id}:
 *   delete:
 *     tags:
 *       - Communications
 *     summary: Delete announcement
 *     description: Delete an announcement (superadmin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Announcement deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/announcements/:id', async (req,res,next)=>{
  try { const r = await svc.deleteAnnouncement(req.params.id); return res.status(r.status).json(r); }
  catch(e){ logger.error(e); next(e); }
});

module.exports = router;
