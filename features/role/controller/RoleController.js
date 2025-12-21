const express = require('express');
const router = express.Router();
const RoleService = require('../services/RoleService');
const logger = require('../../../modules/logger'); 
const checkRole = require('../../../middlewares/rolecheck.middleware');

/**
 * @swagger
 * /role/add:
 *   post:
 *     tags:
 *       - Roles
 *     summary: Create a new role
 *     description: Add a new role to the system (superadmin only)
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
 *             properties:
 *               name:
 *                 type: string
 *                 example: Manager
 *               description:
 *                 type: string
 *                 example: Restaurant manager role
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["read:menu", "write:menu", "read:orders"]
 *     responses:
 *       201:
 *         description: Role created successfully
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
 *                   example: Role created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     roleId:
 *                       type: string
 *                       example: role_1234567890
 *                     name:
 *                       type: string
 *                       example: Manager
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/add',  async (req, res, next) => {
    try {
        
        const result = await RoleService.addRole(req.body);
        return res.status(result.status).json(result);
    } catch (error) {
        logger.error('Error in RoleController - Add Role:', {
            message: error.message,
            stack: error.stack,
            body: req.body
        });
        next(error);
    }
});

/**
 * @swagger
 * /role/all:
 *   get:
 *     tags:
 *       - Roles
 *     summary: Get all roles
 *     description: Retrieve a list of all roles in the system
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Roles retrieved successfully
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
 *                   example: Roles retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       roleId:
 *                         type: string
 *                         example: role_1234567890
 *                       name:
 *                         type: string
 *                         example: Manager
 *                       description:
 *                         type: string
 *                         example: Restaurant manager role
 *                       permissions:
 *                         type: array
 *                         items:
 *                           type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/all', async (req, res, next) => {
    try {
        const result = await RoleService.getAllRoles();
        return res.status(result.status).json(result);
    } catch (error) {
        logger.error('Error in RoleController - Get All Roles:', {
            message: error.message,
            stack: error.stack
        });
        next(error);
    }
});

module.exports = router;
