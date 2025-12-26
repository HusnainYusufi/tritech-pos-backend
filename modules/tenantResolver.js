// modules/tenantResolver.js
'use strict';

const jwt = require('jsonwebtoken');
const logger = require('./logger');

const JWT_SECRET = process.env.JWT_SECRET_KEY;

/**
 * Extract tenant slug from email domain
 * Examples:
 *   john@acme.com → acme
 *   admin@downtown-cafe.com → downtown-cafe
 *   user@sub.domain.com → sub
 * 
 * @param {string} email - Email address
 * @returns {string|null} - Tenant slug or null if invalid
 */
function extractTenantFromEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return null;
  }
  
  const parts = email.split('@');
  if (parts.length !== 2) return null;
  
  const domain = parts[1];
  if (!domain) return null;
  
  // Extract first part of domain as tenant slug
  const tenantSlug = domain.split('.')[0].toLowerCase().trim();
  
  // Validate format (alphanumeric and hyphens only)
  if (!/^[a-z0-9-]+$/.test(tenantSlug)) {
    return null;
  }
  
  return tenantSlug;
}

/**
 * Extract tenant from multiple sources with priority
 * Priority: JWT > Email > Header > Subdomain
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
  
  // Priority 2: Email (for login endpoints)
  if (req.body && req.body.email) {
    tenantSlug = extractTenantFromEmail(req.body.email);
    if (tenantSlug) {
      logger.info('[tenantResolver] Resolved from email', { email: req.body.email, tenantSlug });
      return tenantSlug;
    }
  }
  
  // Priority 3: x-tenant-id header (public endpoints)
  if (req.headers['x-tenant-id']) {
    tenantSlug = String(req.headers['x-tenant-id']).toLowerCase().trim();
    logger.info('[tenantResolver] Resolved from x-tenant-id header', { tenantSlug });
    return tenantSlug;
  }
  
  // Priority 4: Subdomain (web apps)
  if (req.hostname && req.hostname.includes('.')) {
    tenantSlug = req.hostname.split('.')[0].toLowerCase();
    logger.info('[tenantResolver] Resolved from subdomain', { hostname: req.hostname, tenantSlug });
    return tenantSlug;
  }
  
  logger.warn('[tenantResolver] Could not resolve tenant from any source');
  return null;
}

module.exports = {
  extractTenantFromEmail,
  resolveTenantSlug
};

