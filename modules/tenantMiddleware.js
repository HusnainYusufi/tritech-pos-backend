// modules/tenantMiddleware.js
// ⚠️ DEPRECATED: This middleware is no longer used in the codebase.
// Use middlewares/tenantContext.js instead, which properly handles tenant lookup
// and connection management.
//
// This file is kept for backward compatibility but should not be used in new code.

const Tenant = require('../features/tenant/model/Tenant.model');
const { getTenantConnection } = require('./connectionManager');
const logger = require('./logger');

async function tenantMiddleware(req, res, next) {
  try {
    let tenantSlug =
      req.headers['x-tenant-id'] ||
      req.hostname.split('.')[0]; 

    if (!tenantSlug || tenantSlug === 'api') {
      return res.status(400).json({ message: 'Tenant header or subdomain required' });
    }

    // FIXED: Must lookup tenant from DB to get dbUri
    const tenantDoc = await Tenant.findOne({ slug: tenantSlug }).lean();
    if (!tenantDoc) {
      return res.status(404).json({ message: `Tenant "${tenantSlug}" not found` });
    }
    if (!tenantDoc.dbUri) {
      return res.status(500).json({ message: `Tenant "${tenantSlug}" has no dbUri` });
    }

    // FIXED: Pass both tenantSlug AND dbUri
    const conn = await getTenantConnection(tenantSlug, tenantDoc.dbUri);
    req.dbConnection = conn;
    req.tenantSlug = tenantSlug;
    next();
  } catch (err) {
    logger.error('[tenantMiddleware] Error:', { message: err.message, stack: err.stack });
    res.status(500).json({ message: 'Tenant DB connection failed', error: err.message });
  }
}

module.exports = tenantMiddleware;
