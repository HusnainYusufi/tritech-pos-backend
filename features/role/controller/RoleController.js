const express = require('express');
const router = express.Router();
const RoleService = require('../services/RoleService');
const logger = require('../../../modules/logger'); 
const checkRole = require('../../../middlewares/rolecheck.middleware');


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
