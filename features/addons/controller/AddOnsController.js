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

// ========================================
// ADD-ON GROUPS
// ========================================

/**
 * @swagger
 * /t/addons/groups:
 *   post:
 *     tags:
 *       - Menu Add-ons
 *     summary: Create add-on group
 *     description: |
 *       Create a group for organizing add-ons (e.g., "Toppings", "Sauces", "Sides").
 *       Groups can be linked to menu items to show relevant add-ons.
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Toppings
 *               description:
 *                 type: string
 *                 example: Pizza toppings
 *               selectionType:
 *                 type: string
 *                 enum: [single, multiple]
 *                 example: multiple
 *               minSelections:
 *                 type: integer
 *                 example: 0
 *               maxSelections:
 *                 type: integer
 *                 example: 5
 *               isRequired:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       201:
 *         description: Add-on group created successfully
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
 *                 result:
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
router.post('/groups',
  checkPerms(['menu.addons.manage']),
  validate(createGroup),
  async (req,res,next)=>{
    try { const r = await svc.createGroup(req.tenantDb, req.body); res.status(r.status).json(r); }
    catch(e){ logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/addons/groups:
 *   get:
 *     tags:
 *       - Menu Add-ons
 *     summary: Get all add-on groups
 *     description: Retrieve list of add-on groups with filtering
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *         description: Search by name
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Add-on groups retrieved successfully
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
 *                 result:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/groups',
  checkPerms(['menu.addons.read'], { any: true }),
  async (req,res,next)=>{
    try { const r = await svc.listGroups(req.tenantDb, req.query); res.status(r.status).json(r); }
    catch(e){ logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/addons/groups/{id}:
 *   get:
 *     tags:
 *       - Menu Add-ons
 *     summary: Get add-on group by ID
 *     description: Retrieve detailed information about a specific add-on group
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Add-on group ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Add-on group retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/groups/:id',
  checkPerms(['menu.addons.read'], { any: true }),
  async (req,res,next)=>{
    try { const r = await svc.getGroup(req.tenantDb, req.params.id); res.status(r.status).json(r); }
    catch(e){ logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/addons/groups/{id}:
 *   put:
 *     tags:
 *       - Menu Add-ons
 *     summary: Update add-on group
 *     description: Update add-on group details and configuration
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Add-on group ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
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
 *               selectionType:
 *                 type: string
 *                 enum: [single, multiple]
 *               minSelections:
 *                 type: integer
 *               maxSelections:
 *                 type: integer
 *               isRequired:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Add-on group updated successfully
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
router.put('/groups/:id',
  checkPerms(['menu.addons.manage']),
  validate(updateGroup),
  async (req,res,next)=>{
    try { const r = await svc.updateGroup(req.tenantDb, req.params.id, req.body); res.status(r.status).json(r); }
    catch(e){ logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/addons/groups/{id}:
 *   delete:
 *     tags:
 *       - Menu Add-ons
 *     summary: Delete add-on group
 *     description: Delete an add-on group (soft delete)
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Add-on group ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Add-on group deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/groups/:id',
  checkPerms(['menu.addons.manage']),
  async (req,res,next)=>{
    try { const r = await svc.deleteGroup(req.tenantDb, req.params.id); res.status(r.status).json(r); }
    catch(e){ logger.error(e); next(e); }
  }
);

// ========================================
// ADD-ON ITEMS
// ========================================

/**
 * @swagger
 * /t/addons/items:
 *   post:
 *     tags:
 *       - Menu Add-ons
 *     summary: Create add-on item
 *     description: |
 *       Create an individual add-on item (e.g., "Extra Cheese", "BBQ Sauce").
 *       Items belong to groups and can have additional pricing.
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - groupId
 *             properties:
 *               name:
 *                 type: string
 *                 example: Extra Cheese
 *               groupId:
 *                 type: string
 *                 example: group_1234567890
 *               price:
 *                 type: number
 *                 example: 1.50
 *                 description: Additional cost for this add-on
 *               isAvailable:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Add-on item created successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/items',
  checkPerms(['menu.addons.manage']),
  validate(createItem),
  async (req,res,next)=>{
    try { const r = await svc.createItem(req.tenantDb, req.body); res.status(r.status).json(r); }
    catch(e){ logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/addons/items/bulk:
 *   post:
 *     tags:
 *       - Menu Add-ons
 *     summary: Bulk create add-on items
 *     description: Create multiple add-on items at once for efficiency
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                     - groupId
 *                   properties:
 *                     name:
 *                       type: string
 *                     groupId:
 *                       type: string
 *                     price:
 *                       type: number
 *                     isAvailable:
 *                       type: boolean
 *     responses:
 *       201:
 *         description: Add-on items created successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/items/bulk',
  checkPerms(['menu.addons.manage']),
  validate(bulkCreateItems),
  async (req,res,next)=>{
    try { const r = await svc.bulkCreateItems(req.tenantDb, req.body); res.status(r.status).json(r); }
    catch(e){ logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/addons/items:
 *   get:
 *     tags:
 *       - Menu Add-ons
 *     summary: Get all add-on items
 *     description: Retrieve list of add-on items with filtering
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: groupId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by group
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *         description: Search by name
 *       - name: availableOnly
 *         in: query
 *         schema:
 *           type: boolean
 *         description: Show only available items
 *       - $ref: '#/components/parameters/page'
 *       - $ref: '#/components/parameters/limit'
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Add-on items retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/items',
  checkPerms(['menu.addons.read'], { any: true }),
  async (req,res,next)=>{
    try { const r = await svc.listItems(req.tenantDb, req.query); res.status(r.status).json(r); }
    catch(e){ logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/addons/items/{id}:
 *   get:
 *     tags:
 *       - Menu Add-ons
 *     summary: Get add-on item by ID
 *     description: Retrieve detailed information about a specific add-on item
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Add-on item ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Add-on item retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/items/:id',
  checkPerms(['menu.addons.read'], { any: true }),
  async (req,res,next)=>{
    try { const r = await svc.getItem(req.tenantDb, req.params.id); res.status(r.status).json(r); }
    catch(e){ logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/addons/items/{id}:
 *   put:
 *     tags:
 *       - Menu Add-ons
 *     summary: Update add-on item
 *     description: Update add-on item details and pricing
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Add-on item ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *               isAvailable:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Add-on item updated successfully
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
router.put('/items/:id',
  checkPerms(['menu.addons.manage']),
  validate(updateItem),
  async (req,res,next)=>{
    try { const r = await svc.updateItem(req.tenantDb, req.params.id, req.body); res.status(r.status).json(r); }
    catch(e){ logger.error(e); next(e); }
  }
);

/**
 * @swagger
 * /t/addons/items/{id}:
 *   delete:
 *     tags:
 *       - Menu Add-ons
 *     summary: Delete add-on item
 *     description: Delete an add-on item (soft delete)
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Add-on item ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Add-on item deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/items/:id',
  checkPerms(['menu.addons.manage']),
  async (req,res,next)=>{
    try { const r = await svc.deleteItem(req.tenantDb, req.params.id); res.status(r.status).json(r); }
    catch(e){ logger.error(e); next(e); }
  }
);

// ========================================
// POS CONFIGURATION
// ========================================

/**
 * @swagger
 * /t/addons/config/by-category/{categoryId}:
 *   get:
 *     tags:
 *       - Menu Add-ons
 *     summary: Get add-ons config by category
 *     description: |
 *       Retrieve add-on groups and items configured for a specific menu category.
 *       Used by POS to show relevant add-ons when selecting menu items.
 *     parameters:
 *       - $ref: '#/components/parameters/tenantId'
 *       - name: categoryId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Menu category ID
 *     security:
 *       - bearerAuth: []
 *       - tenantHeader: []
 *     responses:
 *       200:
 *         description: Add-ons config retrieved successfully
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
 *                 result:
 *                   type: object
 *                   properties:
 *                     groups:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/config/by-category/:categoryId',
  checkPerms(['menu.addons.read'], { any: true }),
  async (req,res,next)=>{
    try { const r = await svc.getConfigByCategory(req.tenantDb, req.params.categoryId); res.status(r.status).json(r); }
    catch(e){ logger.error(e); next(e); }
  }
);

module.exports = router;
