# PIN Login Debugging Guide

## Critical Bug Fixed
**Issue**: `tenantSlug` was undefined in JWT token generation during PIN login.
**Fix**: Changed `tenantSlug: tenantSlug` to `tenantSlug: pinEntry.tenantSlug` in `TenantAuthService.loginWithPin()`.

## How PIN Login Works

### 1. PIN Setup Flow (`POST /t/staff/{id}/set-pin`)
```
Input: { "pin": "123456" }
Headers: x-tenant-id: "faraz", Authorization: Bearer <admin_token>

Process:
1. Controller adds tenantSlug to payload: { pin: "123456", tenantSlug: "faraz" }
2. StaffService.setPin():
   a. Generates pinKey = HMAC-SHA256(pin, PIN_PEPPER) 
      → "6e208a40e5867d2f630729bcb044e450710729c2fc81774098fc34be64eb71cd"
   b. Generates pinHash = bcrypt(pin + PIN_PEPPER, 12 rounds)
      → "$2a$12$..."
   c. Saves to tenant DB user: { pinHash, pinKey, pinUpdatedAt }
   d. Upserts to main DB TenantPinDirectory: {
        pinKey: "6e208a40...",
        tenantSlug: "faraz",
        tenantUserId: ObjectId("695c19f328e0595f4d5992c1"),
        assignedBranchId: ObjectId("695c0a424a21fc8972afb942"),
        posIds: [...],
        status: "active"
      }
```

### 2. PIN Login Flow (`POST /t/auth/login-pin`)
```
Input: { "pin": "123456", "terminalId": "optional" }
Headers: NONE (public endpoint)

Process:
1. Compute pinKey = HMAC-SHA256(pin, PIN_PEPPER)
2. Query main DB: TenantPinDirectory.findOne({ pinKey })
   → Returns: { tenantSlug: "faraz", tenantUserId: "...", ... }
3. Resolve tenant: Tenant.findOne({ slug: "faraz" })
4. Connect to tenant DB using dbUri
5. Fetch user: TenantUser.findById(tenantUserId)
6. Verify: userDoc.pinHash exists
7. Compare: bcrypt.compare(pin + PIN_PEPPER, userDoc.pinHash)
8. If match: Generate JWT with tenantSlug and return token
```

## Debugging Steps

### Step 1: Verify Environment Variables
```bash
echo $PIN_PEPPER
echo $JWT_SECRET_KEY
```
**Critical**: PIN_PEPPER must be the same when setting PIN and logging in!

### Step 2: Check Main DB PIN Directory
```javascript
// In MongoDB main DB
db.tenantpindirectories.findOne({ pinKey: "6e208a40e5867d2f630729bcb044e450710729c2fc81774098fc34be64eb71cd" })

// Expected output:
{
  _id: ObjectId("..."),
  pinKey: "6e208a40e5867d2f630729bcb044e450710729c2fc81774098fc34be64eb71cd",
  tenantSlug: "faraz",
  tenantUserId: ObjectId("695c19f328e0595f4d5992c1"),
  assignedBranchId: ObjectId("695c0a424a21fc8972afb942"),
  posIds: [...],
  status: "active",
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

### Step 3: Check Tenant DB User
```javascript
// In tenant DB (faraz)
db.tenantusers.findOne({ _id: ObjectId("695c19f328e0595f4d5992c1") })

// Verify these fields exist:
{
  _id: ObjectId("695c19f328e0595f4d5992c1"),
  pinHash: "$2a$12$...", // Must exist and be bcrypt hash
  pinKey: "6e208a40e5867d2f630729bcb044e450710729c2fc81774098fc34be64eb71cd",
  isStaff: true,
  status: "active",
  assignedBranchId: ObjectId("695c0a424a21fc8972afb942"),
  ...
}
```

### Step 4: Manual PIN Verification (Node.js)
```javascript
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const PIN_PEPPER = process.env.PIN_PEPPER || process.env.JWT_SECRET_KEY || 'pin-pepper';
const pin = '123456';

// Generate pinKey (should match DB)
const pinKey = crypto.createHmac('sha256', PIN_PEPPER).update(pin).digest('hex');
console.log('Generated pinKey:', pinKey);
// Expected: 6e208a40e5867d2f630729bcb044e450710729c2fc81774098fc34be64eb71cd

// Compare with stored hash
const storedHash = '$2a$12$...'; // Get from DB
const isMatch = await bcrypt.compare(pin + PIN_PEPPER, storedHash);
console.log('PIN matches:', isMatch); // Should be true
```

### Step 5: Test API Call
```bash
curl -X POST http://localhost:3004/api/t/auth/login-pin \
  -H "Content-Type: application/json" \
  -d '{"pin":"123456"}'
```

## Common Issues & Solutions

### Issue 1: "Invalid credentials" - PIN directory not found
**Symptom**: `pinEntry` is null in step 2 of login flow.
**Cause**: PIN directory not synced to main DB.
**Solution**: Re-set the PIN via `POST /t/staff/{id}/set-pin`.

### Issue 2: "Invalid credentials" - PIN hash mismatch
**Symptom**: `pinEntry` found, but `bcrypt.compare()` returns false.
**Cause**: 
- PIN_PEPPER changed between set-pin and login
- PIN was set before PIN_PEPPER was added
- PIN was manually modified in DB
**Solution**: 
1. Verify PIN_PEPPER env var is consistent
2. Re-set the PIN via API (not manual DB edit)

### Issue 3: "Account is not active"
**Symptom**: User status is not "active".
**Solution**: Update user status: `POST /t/staff/{id}/status` with `{"status":"active"}`

### Issue 4: "Tenant not found"
**Symptom**: Tenant document missing or has no dbUri.
**Solution**: Verify tenant exists in main DB with valid dbUri.

### Issue 5: "PIN login is only available for staff accounts"
**Symptom**: User's `isStaff` field is false/missing.
**Solution**: Ensure user was created via Staff API, not regular user creation.

## Testing Checklist

- [ ] PIN_PEPPER env var is set and consistent
- [ ] PIN directory entry exists in main DB with correct pinKey
- [ ] Tenant user exists with matching pinHash in tenant DB
- [ ] User status is "active"
- [ ] User isStaff is true
- [ ] User has assignedBranchId set
- [ ] Tenant document has valid dbUri
- [ ] Manual bcrypt comparison succeeds
- [ ] API call returns 200 with valid JWT token

## Production Recommendations

1. **Environment Variables**: Set `PIN_PEPPER` explicitly (don't rely on JWT_SECRET_KEY fallback)
2. **Monitoring**: Log PIN login failures with pinKey (not PIN) for debugging
3. **Rate Limiting**: Already implemented (10 attempts per 15 min)
4. **Account Locking**: Already implemented (5 failed attempts = 15 min lock)
5. **Audit Trail**: Consider logging successful PIN logins with IP/device info
6. **PIN Rotation**: Implement PIN expiry policy (e.g., force change every 90 days)
7. **PIN Complexity**: Consider enforcing minimum PIN length (currently allows any)

## Code Files Involved

- `features/tenant-auth/services/TenantAuthService.js` - Login logic
- `features/staff/services/StaffService.js` - PIN setup logic
- `features/tenant-auth/repository/tenantPinDirectory.repository.js` - Main DB directory
- `features/tenant-auth/model/TenantPinDirectory.model.js` - Main DB schema
- `features/tenant-auth/controller/TenantAuthController.js` - Public endpoint
- `features/staff/controller/StaffController.js` - PIN setup endpoint
- `middlewares/Base.js` - Rate limiting configuration

