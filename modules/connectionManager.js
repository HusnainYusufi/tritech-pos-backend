// modules/connectionManager.js
'use strict';

const mongoose = require('mongoose');
const logger = require('./logger');

const connectionCache = {}; // slug -> mongoose.Connection

/**
 * Get (or create) a cached tenant DB connection.
 * We pass dbUri to avoid re-querying Tenant inside this module.
 */
async function getTenantConnection(tenantSlug, dbUri) {
  if (!tenantSlug) throw new Error('getTenantConnection: tenantSlug required');

  // Already cached?
  if (connectionCache[tenantSlug]) return connectionCache[tenantSlug];

  if (!dbUri) throw new Error(`getTenantConnection: dbUri required for "${tenantSlug}"`);

  logger.info(`Connecting tenant DB: ${tenantSlug}`);
  const conn = await mongoose.createConnection(dbUri, {
    // modern options no longer required in latest mongoose,
    // but harmless if you're on older versions:
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  conn.on('error', (err) => logger.error(`Mongo error [${tenantSlug}]`, { message: err.message, stack: err.stack }));
  conn.once('open', () => logger.info(`Tenant DB ready [${tenantSlug}]`));

  connectionCache[tenantSlug] = conn;
  return conn;
}

function clearTenantConnection(tenantSlug) {
  if (connectionCache[tenantSlug]) {
    connectionCache[tenantSlug].close().catch(() => {});
    delete connectionCache[tenantSlug];
  }
}

module.exports = { getTenantConnection, clearTenantConnection };
