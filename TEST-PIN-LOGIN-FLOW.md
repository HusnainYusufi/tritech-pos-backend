# PIN Login Flow - Complete Test Guide

## Architecture Summary

### ✅ What We Changed
1. **Tenant Resolution**: Added email-based fallback for `/t/auth/login` (owner contact email lookup)
2. **Subdomain Filtering**: Blocked `api`, `www`, `admin` from being treated as tenant slugs
3. **Header Priority**: `x-tenant-id` header still works (Priority 2)

### ✅ What We DID NOT Change
1. **PIN Login Logic**: Completely untouched
2. **Staff Assignment**: `assignedBranchId` and `posIds` logic intact
3. **Staff Creation**: All validation and assignment logic preserved

---

## Complete Flow Test

### Step 1: Create a Tenant
```bash
POST /admin/tenants
Headers:
  Authorization: Bearer <admin-token>
  Content-Type: application/json

Body:
{
  "name": "Test Restaurant",
  "slug": "extraction-testt",
  "contactEmail": "owner@extraction.com",
  "status": "trial"
}
```

**Expected**: Tenant created with `slug: "extraction-testt"`

---

### Step 2: Create a Branch
```bash
POST /t/branches
Headers:
  Authorization: Bearer <owner-token>
  x-tenant-id: extraction-testt
  Content-Type: application/json

Body:
{
  "name": "Main Branch",
  "code": "main",
  "status": "active",
  "address": {
    "city": "Riyadh",
    "country": "Saudi Arabia"
  }
}
```

**Expected**: Branch created, note the `_id` (e.g., `65a1234567890abcdef12345`)

---

### Step 3: Create a POS Terminal
```bash
POST /t/pos/terminals
Headers:
  Authorization: Bearer <owner-token>
  x-tenant-id: extraction-testt
  Content-Type: application/json

Body:
{
  "name": "Counter 1",
  "code": "counter-1",
  "branchId": "<branch-id-from-step-2>",
  "status": "active",
  "deviceInfo": {
    "type": "tablet",
    "os": "android"
  }
}
```

**Expected**: POS terminal created, note the `_id` (e.g., `65b9876543210fedcba09876`)

---

### Step 4: Create a Staff Member (Cashier)
```bash
POST /t/staff
Headers:
  Authorization: Bearer <owner-token>
  x-tenant-id: extraction-testt
  Content-Type: application/json

Body:
{
  "fullName": "John Cashier",
  "email": "john@extraction.com",
  "password": "Password123!",
  "assignedBranchId": "<branch-id-from-step-2>",
  "posIds": ["<pos-id-from-step-3>"],
  "pin": "123456",
  "roles": ["cashier"],
  "position": "Cashier"
}
```

**Expected**: 
- Staff created successfully
- `assignedBranchId` set to the branch
- `posIds` contains the POS terminal
- `pinKey` and `pinHash` generated

---

### Step 5: Login with PIN (THE CRITICAL TEST)
```bash
POST /t/auth/login-pin
Headers:
  x-tenant-id: extraction-testt
  Content-Type: application/json

Body:
{
  "pin": "123456"
}
```

**Expected Response**:
```json
{
  "status": 200,
  "message": "Login successful",
  "result": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "_id": "...",
      "fullName": "John Cashier",
      "email": "john@extraction.com",
      "roles": ["cashier"],
      "assignedBranchId": "65a1234567890abcdef12345",
      "posIds": ["65b9876543210fedcba09876"],
      "isStaff": true,
      "position": "Cashier"
    },
    "branchId": "65a1234567890abcdef12345",
    "posId": "65b9876543210fedcba09876",
    "posName": "Counter 1",
    "requiresPosSelection": false,
    "availableTerminals": [
      {
        "_id": "65b9876543210fedcba09876",
        "name": "Counter 1",
        "code": "counter-1",
        "status": "active"
      }
    ],
    "tillSessionId": null
  }
}
```

---

## Common Errors & Solutions

### Error 1: "Missing tenant identifier"
**Cause**: No `x-tenant-id` header sent
**Solution**: Add `x-tenant-id: extraction-testt` header

### Error 2: "Tenant 'api' not found"
**Cause**: Request sent to `api.domain.com` subdomain
**Solution**: ✅ Already fixed - subdomain resolver now ignores `api`

### Error 3: "Cashier is not assigned to any branch"
**Cause**: Staff created without `assignedBranchId`
**Solution**: Include `assignedBranchId` when creating staff (Step 4)

### Error 4: "Invalid credentials" (PIN)
**Cause**: 
- Wrong PIN entered
- PIN not set during staff creation
- PIN pepper mismatch (env variable changed)

**Solution**: 
- Verify PIN is exactly 6 digits
- Ensure `pin` field was included in staff creation
- Check `PIN_PEPPER` env variable is consistent

### Error 5: "PIN already in use"
**Cause**: Another user in the same tenant has this PIN
**Solution**: Use a different PIN (PINs must be unique per tenant)

---

## Verification Checklist

- [ ] Tenant created with correct slug
- [ ] Branch created and ID noted
- [ ] POS terminal created and ID noted
- [ ] Staff created with:
  - [ ] `assignedBranchId` set
  - [ ] `posIds` array populated
  - [ ] `pin` set (6 digits)
- [ ] PIN login works with `x-tenant-id` header
- [ ] Response includes:
  - [ ] Valid JWT token
  - [ ] User object with `assignedBranchId` and `posIds`
  - [ ] `branchId` and `posId` in result
  - [ ] `availableTerminals` array
  - [ ] `requiresPosSelection: false` (if single POS assigned)

---

## Architecture Integrity Verification

### ✅ Unchanged Components
1. **`features/tenant-auth/services/TenantAuthService.js`**
   - `loginWithPin()` method: INTACT
   - PIN validation logic: INTACT
   - Branch/POS assignment logic: INTACT

2. **`features/staff/services/StaffService.js`**
   - `create()` method: INTACT
   - `assignedBranchId` validation: INTACT
   - `posIds` validation: INTACT
   - PIN generation (`buildPinSecrets`): INTACT

3. **`features/tenant-auth/model/TenantUser.schema.js`**
   - `assignedBranchId` field: INTACT
   - `posIds` field: INTACT
   - `pinHash` / `pinKey` fields: INTACT

### ✅ Changed Components (Safe)
1. **`middlewares/tenantContext.js`**
   - Added email-based tenant lookup for `/t/auth/login`
   - Does NOT affect PIN login (no email in PIN request)

2. **`modules/tenantResolver.js`**
   - Added subdomain filtering (`api`, `www`, `admin`)
   - `x-tenant-id` header still works (Priority 2)

---

## Conclusion

**The PIN login flow is 100% intact.** The changes made only affected:
1. Email-based tenant resolution (for owner login without header)
2. Subdomain filtering (to prevent `api` being treated as tenant)

All staff assignment logic (`assignedBranchId`, `posIds`) and PIN authentication remain unchanged and functional.

**To use PIN login**: Send `x-tenant-id` header with the request. That's it.

