// modules/connectionManager.js
'use strict';

const mongoose = require('mongoose');
const logger = require('./logger');
const { withAuthSource } = require('./mongoUri');

const connectionCache = {}; // slug -> mongoose.Connection

/**
 * Get (or create) a cached tenant DB connection.
 * We pass dbUri to avoid re-querying Tenant inside this module.
 */
async function getTenantConnection(tenantSlug, dbUri) {
  if (!tenantSlug) {
    const err = new Error('getTenantConnection: tenantSlug required');
    logger.error('[connectionManager] Missing tenantSlug', { error: err.message });
    throw err;
  }

  // Already cached?
  if (connectionCache[tenantSlug]) {
    logger.info(`[connectionManager] Using cached connection: ${tenantSlug}`);
    return connectionCache[tenantSlug];
  }

  if (!dbUri) {
    const err = new Error(`getTenantConnection: dbUri required for "${tenantSlug}"`);
    logger.error('[connectionManager] Missing dbUri', { tenantSlug, error: err.message });
    throw err;
  }

  try {
    // Ensure authSource is present so SCRAM auth matches the admin DB configuration
    const normalizedUri = withAuthSource(dbUri);
    
    logger.info(`[connectionManager] Connecting tenant DB: ${tenantSlug}`, {
      originalUri: dbUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'),
      normalizedUri: normalizedUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')
    });

    const conn = await mongoose.createConnection(normalizedUri, {
      // modern options no longer required in latest mongoose,
      // but harmless if you're on older versions:
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    conn.on('error', (err) => {
      logger.error(`[connectionManager] Mongo error [${tenantSlug}]`, { 
        message: err.message, 
        stack: err.stack 
      });
    });
    
    conn.once('open', () => {
      logger.info(`[connectionManager] Tenant DB ready [${tenantSlug}]`);
    });

    connectionCache[tenantSlug] = conn;
    logger.info(`[connectionManager] Connection cached: ${tenantSlug}`);
    return conn;
  } catch (err) {
    logger.error(`[connectionManager] Failed to connect tenant DB: ${tenantSlug}`, {
      message: err.message,
      stack: err.stack,
      dbUri: dbUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')
    });
    throw err;
  }
}

function clearTenantConnection(tenantSlug) {
  if (connectionCache[tenantSlug]) {
    connectionCache[tenantSlug].close().catch(() => {});
    delete connectionCache[tenantSlug];
  }
}

module.exports = { getTenantConnection, clearTenantConnection };
