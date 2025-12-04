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
  try {
    let tenantSlug = null;

    if (req.headers['x-tenant-id']) {
      tenantSlug = String(req.headers['x-tenant-id']).toLowerCase().trim();
    } else if (req.hostname && req.hostname.includes('.')) {
      tenantSlug = req.hostname.split('.')[0].toLowerCase();
    }

    if (!tenantSlug) {
      return res.status(400).json({
        status: 400,
        message: 'Missing tenant identifier (x-tenant-id header or subdomain)',
      });
    }

    // Load tenant meta from main DB
    const tenantDoc = await Tenant.findOne({ slug: tenantSlug }).lean();
    if (!tenantDoc) {
      return res.status(404).json({ status: 404, message: `Tenant "${tenantSlug}" not found` });
    }
    if (!tenantDoc.dbUri) {
      return res.status(500).json({ status: 500, message: `Tenant "${tenantSlug}" has no dbUri` });
    }

    // Get (cached) per-tenant connection
    const tenantDb = await getTenantConnection(tenantSlug, tenantDoc.dbUri);

    // Ensure default roles (and permissions) exist for this tenant DB
    await TenantRoleService.ensureDefaultsSeeded(tenantDb, tenantSlug);

    // Attach context
    req.tenantSlug = tenantSlug;
    req.tenant = tenantDoc;   // <-- IMPORTANT for tenantCheckPermissions
    req.tenantDb = tenantDb;

    next();
  } catch (err) {
    console.error('❌ tenantContext error:', err);
    return res.status(500).json({
      status: 500,
      message: 'Tenant DB connection failed',
      error: err.message,
    });
  }
}

module.exports = tenantContext;
