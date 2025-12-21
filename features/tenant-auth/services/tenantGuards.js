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

const posGuard = (userDoc, posId) => {
  // If no user provided (public endpoint), skip guard
  if (!userDoc) return true;
  
  // If no posId to check or user has tenant scope, allow
  if (!posId || hasTenantScope(userDoc)) return true;
  
  // If user has no POS restrictions (posIds is empty), allow any POS in their branch
  const assignedPosIds = (userDoc.posIds || []).map(String);
  if (assignedPosIds.length === 0) return true;
  
  // User has specific POS restrictions - check if this POS is allowed
  if (!assignedPosIds.includes(String(posId))) {
    throw new AppError('You are not assigned to this POS terminal', 403);
  }
  return true;
};

module.exports = { hasTenantScope, branchGuard, posGuard };
