// modules/tenantMiddleware.js
const { getTenantConnection } = require('./connectionManager');

async function tenantMiddleware(req, res, next) {
  try {

    let tenantSlug =
      req.headers['x-tenant-id'] ||
      req.hostname.split('.')[0]; 

    if (!tenantSlug || tenantSlug === 'api') {
      return res.status(400).json({ message: 'Tenant header or subdomain required' });
    }

    const conn = await getTenantConnection(tenantSlug);
    req.dbConnection = conn;
    req.tenantSlug = tenantSlug;
    next();
  } catch (err) {
    console.error('Tenant middleware error:', err);
    res.status(500).json({ message: 'Tenant DB connection failed', error: err.message });
  }
}

module.exports = tenantMiddleware;
