// middlewares/tenantContext.js
'use strict';

const Tenant = require('../features/tenant/model/Tenant.model');
const { getTenantConnection } = require('../modules/connectionManager');
const TenantRoleService = require('../features/tenant-rbac/services/TenantRoleService');
const { resolveTenantSlug } = require('../modules/tenantResolver');

/**
 * Smart tenant resolution middleware
 * Resolves tenant from: JWT token > Email > x-tenant-id header > Subdomain
 * Attaches:
 *   req.tenantSlug  (string)
 *   req.tenant      (tenant doc from main DB)
 *   req.tenantDb    (mongoose Connection to tenant DB)
 */
async function tenantContext(req, res, next) {
  const logger = require('../modules/logger');
  
  try {
    // Smart tenant resolution (JWT > Email > Header > Subdomain)
    const tenantSlug = await resolveTenantSlug(req);
    
    if (!tenantSlug) {
      logger.warn('[tenantContext] Missing tenant identifier', {
        hasAuth: !!req.headers['authorization'],
        hasHeader: !!req.headers['x-tenant-id'],
        hasEmail: !!(req.body && req.body.email),
        hostname: req.hostname
      });
      return res.status(400).json({
        status: 400,
        message: 'Missing tenant identifier. Provide email, x-tenant-id header, or use tenant subdomain.',
      });
    }

    logger.info(`[tenantContext] Resolved tenant: ${tenantSlug}`);

    // Load tenant meta from main DB
    const tenantDoc = await Tenant.findOne({ slug: tenantSlug }).lean();
    if (!tenantDoc) {
      logger.error(`[tenantContext] Tenant not found: ${tenantSlug}`);
      return res.status(404).json({ 
        status: 404, 
        message: `Tenant "${tenantSlug}" not found` 
      });
    }
    
    if (!tenantDoc.dbUri) {
      logger.error(`[tenantContext] Tenant has no dbUri: ${tenantSlug}`);
      return res.status(500).json({ 
        status: 500, 
        message: `Tenant "${tenantSlug}" database not configured` 
      });
    }

    // Get (cached) per-tenant connection
    const tenantDb = await getTenantConnection(tenantSlug, tenantDoc.dbUri);

    // Ensure default roles exist
    await TenantRoleService.ensureDefaultsSeeded(tenantDb, tenantSlug);

    // Attach context
    req.tenantSlug = tenantSlug;
    req.tenant = tenantDoc;
    req.tenantDb = tenantDb;

    logger.info(`[tenantContext] Context attached: ${tenantSlug}`);
    next();
  } catch (err) {
    logger.error('[tenantContext] Error', {
      message: err.message,
      stack: err.stack
    });
    return res.status(500).json({
      status: 500,
      message: 'Tenant resolution failed',
      error: err.message
    });
  }
}

module.exports = tenantContext;
