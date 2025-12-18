# 🔥 CRITICAL: Cashier Permission Issue - Root Cause Analysis

## Problem
Cashiers getting "insufficient permissions" error when trying to access POS endpoints.

## Root Cause
The permission checking middleware has a **CRITICAL LOGIC FLAW** in how it handles branch-scoped roles.

### Current Broken Logic (lines 102-107):
```javascript
// coarse roles -> all role permissions
for (const k of coarseRoles) {
  const r = rolesMap[k];
  if (!r) continue;
  for (const p of r.permissions) granted.add(p);  // ❌ IGNORES SCOPE!
}
```

**Problem:** This code adds permissions from the `roles` array WITHOUT checking if the role is branch-scoped!

### The Cashier Role Configuration:
- **Scope:** `branch` (not `tenant`)
- **Permissions:** `['pos.orders.create', 'pos.orders.read', ...]`
- **Expected Behavior:** Permissions should ONLY be granted when operating within assigned branch

### What's Happening:
1. Cashier user has `roles: ['cashier']` in their user document
2. Permission middleware loads cashier role from database
3. **BUG:** Code adds cashier permissions WITHOUT checking branch context
4. Later, fine-grained `roleGrants` logic DOES check branch scope
5. Result: Inconsistent permission granting

## The Fix

### Option 1: Respect Scope in Coarse Roles (RECOMMENDED)
```javascript
// coarse roles -> respect scope
for (const k of coarseRoles) {
  const r = rolesMap[k];
  if (!r) continue;
  
  // ✅ FIX: Check scope before granting permissions
  if (r.scope === 'tenant') {
    // Tenant-scoped roles grant permissions everywhere
    for (const p of r.permissions) granted.add(p);
  } else if (r.scope === 'branch') {
    // Branch-scoped roles need branch context
    // For coarse roles, we can't determine branch, so skip
    // User must use roleGrants for branch-scoped permissions
    continue;
  }
}
```

### Option 2: Always Grant Coarse Role Permissions (SIMPLER)
```javascript
// coarse roles -> grant all permissions (legacy behavior)
// This treats roles array as "always active" regardless of scope
for (const k of coarseRoles) {
  const r = rolesMap[k];
  if (!r) continue;
  for (const p of r.permissions) granted.add(p);
}
```

**Recommendation:** Use Option 2 for immediate fix, then migrate to Option 1 + proper roleGrants.

## Immediate Action Required

### Fix 1: Update Permission Middleware
File: `middlewares/tenantCheckPermissions.js`

Change lines 102-107 to handle branch scope properly.

### Fix 2: Ensure Cashiers Use Proper Role Assignment
Cashiers should be assigned via `roleGrants` with branch context:

```javascript
{
  fullName: "John Cashier",
  email: "john@example.com",
  roles: ['cashier'],  // ✅ Keep for backward compatibility
  roleGrants: [        // ✅ ADD THIS for proper branch scoping
    {
      roleKey: 'cashier',
      scope: 'branch',
      branchId: ObjectId('...')
    }
  ],
  branchIds: [ObjectId('...')],
  isStaff: true
}
```

## Testing
1. Login as cashier with PIN
2. Open till session
3. Try to create POS order
4. Should work without "insufficient permissions" error

## Impact
- **Critical:** Blocks all cashier operations
- **Affected:** All tenants with cashier users
- **Priority:** IMMEDIATE FIX REQUIRED

