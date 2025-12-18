// features/tenant-auth/services/tenantGuards.js
'use strict';

const AppError = require('../../../modules/AppError');

const hasTenantScope = (userDoc) => (userDoc?.roles || []).includes('owner')
  || (Array.isArray(userDoc?.roleGrants) && userDoc.roleGrants.some((g) => g.scope === 'tenant'));

const branchGuard = (userDoc, branchId) => {
  // If no user provided (public endpoint), skip guard
  if (!userDoc) return true;
  
  // If no branchId to check or user has tenant scope, allow
  if (!branchId || hasTenantScope(userDoc)) return true;
  
  // Check if user is assigned to this branch
  const branches = (userDoc.branchIds || []).map(String);
  if (!branches.includes(String(branchId))) {
    throw new AppError('User is not assigned to this branch', 403);
  }
  return true;
};

module.exports = { hasTenantScope, branchGuard };
