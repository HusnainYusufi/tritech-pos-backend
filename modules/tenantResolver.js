// modules/tenantResolver.js
'use strict';

const jwt = require('jsonwebtoken');
const logger = require('./logger');

const JWT_SECRET = process.env.JWT_SECRET_KEY;

// NOTE: We intentionally do NOT derive tenant from email domain (e.g., gmail/outlook)
// because that is not a reliable tenant identifier in real deployments.

/**
 * Extract tenant from multiple sources with priority
 * Priority: JWT > Header > Subdomain
 * 
 * @param {Object} req - Express request object
 * @returns {Promise<string|null>} - Tenant slug or null
 */
async function resolveTenantSlug(req) {
  let tenantSlug = null;
  
  // Priority 1: JWT token (authenticated requests)
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.tenantSlug) {
          logger.info('[tenantResolver] Resolved from JWT token', { tenantSlug: decoded.tenantSlug });
          return decoded.tenantSlug;
        }
      } catch (err) {
        // Token invalid or expired, continue to other sources
        logger.debug('[tenantResolver] JWT verification failed, trying other sources', { error: err.message });
      }
    }
  }
  
  // Priority 2: x-tenant-id header (public endpoints / legacy clients)
  if (req.headers['x-tenant-id']) {
    tenantSlug = String(req.headers['x-tenant-id']).toLowerCase().trim();
    logger.info('[tenantResolver] Resolved from x-tenant-id header', { tenantSlug });
    return tenantSlug;
  }
  
  // Priority 3: Subdomain (web apps)
  if (req.hostname && req.hostname.includes('.')) {
    tenantSlug = req.hostname.split('.')[0].toLowerCase();
    logger.info('[tenantResolver] Resolved from subdomain', { hostname: req.hostname, tenantSlug });
    return tenantSlug;
  }
  
  logger.warn('[tenantResolver] Could not resolve tenant from any source');
  return null;
}

module.exports = {
  resolveTenantSlug
};

