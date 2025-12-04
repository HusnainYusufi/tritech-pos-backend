// middlewares/tenantCheckPermissions.js
'use strict';

const AppError = require('../modules/AppError');
const TenantRoleRepo = require('../features/tenant-rbac/repository/tenantRole.repository');
const TenantUserRepo = require('../features/tenant-auth/repository/tenantUser.repository');

const ROLE_CACHE = new Map(); // key: tenantSlug, value: { ts, map: { roleKey -> { permissions, scope } } }
const TTL_MS = 60 * 1000;

const now = () => Date.now();

function wildcardMatch(perm, pattern) {
  if (pattern === '*') return true;
  if (pattern === perm) return true;
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2);
    return perm === prefix || perm.startsWith(prefix + '.');
  }
  return false;
}
function hasAll(required, grantedSet) {
  if (grantedSet.has('*')) return true;
  return required.every(req => {
    if (grantedSet.has(req)) return true;
    for (const g of grantedSet) if (wildcardMatch(req, g)) return true;
    return false;
  });
}

async function loadRolesMap(conn, tenantSlug) {
  const key = tenantSlug || '_no_slug_';
  const entry = ROLE_CACHE.get(key);
  if (entry && (now() - entry.ts) < TTL_MS) return entry.map;

  const Role = TenantRoleRepo.model(conn);
  const roles = await Role.find({}).select('key permissions scope').lean();
  const map = {};
  for (const r of roles) map[r.key] = { permissions: r.permissions || [], scope: r.scope || 'tenant' };

  ROLE_CACHE.set(key, { ts: now(), map });
  return map;
}

/**
 * checkTenantPerms(requiredPerms, opts?)
 * opts:
 *   any?: boolean (require ANY instead of ALL)
 *   branchParam?: string (where to read branchId from req.params/body/query)
 *   branchHeader?: string (default 'x-branch-id')
 *   allowOwnerBypass?: boolean (default true)
 */
function invalidateRoleCache(tenantSlug) {
  const key = tenantSlug || '_no_slug_';
  ROLE_CACHE.delete(key);
}

function checkTenantPerms(requiredPerms = [], opts = {}) {
  const {
    any = false,
    branchParam = null,
    branchHeader = 'x-branch-id',
    allowOwnerBypass = true
  } = opts;

  const required = Array.isArray(requiredPerms) ? requiredPerms : [requiredPerms];

  return async (req, res, next) => {
    try {
      const conn = req.tenantDb;
      // Accept either full tenant doc or just the slug
      const tenant = req.tenant || (req.tenantSlug ? { slug: req.tenantSlug } : null);
      if (!conn || !tenant) throw new AppError('Tenant context missing', 500);

      const uid = req.user?.uid;
      if (!uid) throw new AppError('Unauthorized', 401);

      // Always load fresh user
      const User = TenantUserRepo.model(conn);
      const userDoc = await User.findById(uid).lean();
      if (!userDoc) throw new AppError('Unauthorized', 401);
      if (userDoc.status !== 'active') throw new AppError('Account is not active', 403);

      // Owner bypass (coarse roles array on userDoc)
      const coarseRoles = userDoc.roles || [];
      if (allowOwnerBypass && coarseRoles.includes('owner')) return next();

      // Compute branch context if needed
      let ctxBranchId = null;
      if (branchParam) {
        ctxBranchId = req.params?.[branchParam] || req.body?.[branchParam] || req.query?.[branchParam] || null;
      }
      if (!ctxBranchId) {
        const h = req.header(branchHeader);
        if (h) ctxBranchId = h;
      }

      // Build granted permissions from roles + fine-grained grants
      const rolesMap = await loadRolesMap(conn, tenant.slug);
      const granted = new Set();

      // coarse roles -> all role permissions
      for (const k of coarseRoles) {
        const r = rolesMap[k];
        if (!r) continue;
        for (const p of r.permissions) granted.add(p);
      }

      // fine-grained roleGrants (respect scope)
      if (Array.isArray(userDoc.roleGrants)) {
        for (const g of userDoc.roleGrants) {
          const r = rolesMap[g.roleKey];
          if (!r) continue;
          if (r.scope === 'tenant') {
            for (const p of r.permissions) granted.add(p);
          } else if (r.scope === 'branch') {
            if (g.branchId && ctxBranchId && String(g.branchId) === String(ctxBranchId)) {
              for (const p of r.permissions) granted.add(p);
            }
          }
        }
      }

      const pass = any
        ? required.some(one => hasAll([one], granted))
        : hasAll(required, granted);

      if (!pass) throw new AppError('Forbidden: insufficient permissions', 403);
      next();
    } catch (e) { next(e); }
  };
}

checkTenantPerms.invalidateRoleCache = invalidateRoleCache;

module.exports = checkTenantPerms;
