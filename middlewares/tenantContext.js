// middlewares/tenantContext.js
'use strict';

const Tenant = require('../features/tenant/model/Tenant.model');
const { getTenantConnection } = require('../modules/connectionManager');
const TenantRoleService = require('../features/tenant-rbac/services/TenantRoleService');

/**
 * Resolves tenant from header "x-tenant-id" OR subdomain.
 * Attaches:
 *   req.tenantSlug  (string)
 *   req.tenant      (tenant doc from main DB)
 *   req.tenantDb    (mongoose Connection to tenant DB)
 */
async function tenantContext(req, res, next) {
  const logger = require('../modules/logger');
  
  try {
    let tenantSlug = null;

    if (req.headers['x-tenant-id']) {
      tenantSlug = String(req.headers['x-tenant-id']).toLowerCase().trim();
    } else if (req.hostname && req.hostname.includes('.')) {
      tenantSlug = req.hostname.split('.')[0].toLowerCase();
    }

    if (!tenantSlug) {
      logger.warn('[tenantContext] Missing tenant identifier', {
        headers: req.headers,
        hostname: req.hostname
      });
      return res.status(400).json({
        status: 400,
        message: 'Missing tenant identifier (x-tenant-id header or subdomain)',
      });
    }

    logger.info(`[tenantContext] Resolving tenant: ${tenantSlug}`);

    // Load tenant meta from main DB
    const tenantDoc = await Tenant.findOne({ slug: tenantSlug }).lean();
    if (!tenantDoc) {
      logger.error(`[tenantContext] Tenant not found in database: ${tenantSlug}`);
      return res.status(404).json({ 
        status: 404, 
        message: `Tenant "${tenantSlug}" not found` 
      });
    }
    
    if (!tenantDoc.dbUri) {
      logger.error(`[tenantContext] Tenant has no dbUri: ${tenantSlug}`, { tenantDoc });
      return res.status(500).json({ 
        status: 500, 
        message: `Tenant "${tenantSlug}" has no dbUri` 
      });
    }

    logger.info(`[tenantContext] Tenant found, connecting to DB: ${tenantSlug}`, {
      dbUri: tenantDoc.dbUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@') // Mask password in logs
    });

    // Get (cached) per-tenant connection
    const tenantDb = await getTenantConnection(tenantSlug, tenantDoc.dbUri);

    logger.info(`[tenantContext] DB connection established: ${tenantSlug}`);

    // Ensure default roles (and permissions) exist for this tenant DB
    await TenantRoleService.ensureDefaultsSeeded(tenantDb, tenantSlug);

    // Attach context
    req.tenantSlug = tenantSlug;
    req.tenant = tenantDoc;   // <-- IMPORTANT for tenantCheckPermissions
    req.tenantDb = tenantDb;

    logger.info(`[tenantContext] Context attached successfully: ${tenantSlug}`);
    next();
  } catch (err) {
    logger.error('[tenantContext] Error occurred', {
      message: err.message,
      stack: err.stack,
      tenantSlug: req.tenantSlug
    });
    return res.status(500).json({
      status: 500,
      message: 'Tenant DB connection failed',
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}

module.exports = tenantContext;
