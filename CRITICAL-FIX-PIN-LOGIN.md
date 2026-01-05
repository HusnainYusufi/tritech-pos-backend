# 🔴 CRITICAL FIX: PIN Login "Invalid Credentials" Issue

## Executive Summary
**Status**: ✅ Code bugs fixed, ⚠️ Environment configuration required  
**Impact**: PIN login failing due to PIN_PEPPER mismatch  
**Action Required**: Re-set all staff PINs after deploying latest code

---

## Bugs Fixed (Production-Ready)

### 1. ✅ JWT Token Bug (CRITICAL)
**File**: `features/tenant-auth/services/TenantAuthService.js:215`  
**Issue**: `tenantSlug` was undefined in JWT payload during PIN login  
**Fix**: Changed `tenantSlug: tenantSlug` → `tenantSlug: pinEntry.tenantSlug`  
**Impact**: Without this fix, JWT tokens were invalid and all authenticated requests would fail

### 2. ✅ Missing Logger Import
**File**: `features/staff/services/StaffService.js`  
**Issue**: `logger.error()` called but logger not imported  
**Fix**: Added `const logger = require('../../../modules/logger');`  
**Impact**: Prevents runtime errors when PIN directory sync fails

### 3. ✅ Module Import Path
**File**: `features/tenant-auth/services/TenantAuthService.js`  
**Issue**: Incorrect relative path for `tenantPinDirectory.repository`  
**Fix**: Corrected import path to `../repository/tenantPinDirectory.repository`  
**Impact**: Prevents "Cannot find module" errors

---

## Root Cause: PIN_PEPPER Mismatch

### The Problem
Your PIN was created with a **different `PIN_PEPPER`** than what's currently active:

```
Database pinKey:    6e208a40e5867d2f630729bcb044e450710729c2fc81774098fc34be64eb71cd
Current pinKey:     6c50ab5bd0e6df91e8efe04149acd7e7b33b4cdfb04f990186880de5fe1b3a68
                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                    MISMATCH - Login will always fail!
```

### Why This Happens
1. PIN was set when `PIN_PEPPER` had one value (or wasn't set)
2. Server restarted with different `PIN_PEPPER` (or JWT_SECRET_KEY changed)
3. PIN lookup succeeds (finds directory entry) but hash comparison fails

### Current Environment Status
```
✅ JWT_SECRET_KEY: Not set (using default fallback)
⚠️  PIN_PEPPER: Not set (using default 'pin-pepper')
```

---

## Solution: Re-Set All Staff PINs

### Step 1: Deploy Latest Code
```bash
# On production server
cd /var/www/tritech-pos-backend
git pull origin main
pm2 restart all
```

### Step 2: Verify Environment Variables
```bash
# Check current values
echo $PIN_PEPPER
echo $JWT_SECRET_KEY

# If not set, add to .env or export
export PIN_PEPPER="your-secure-pepper-value"
export JWT_SECRET_KEY="your-jwt-secret"
```

**IMPORTANT**: Once set, these values must NEVER change in production!

### Step 3: Re-Set Staff PINs
For each staff member with PIN login:

```bash
POST /t/staff/{staffId}/set-pin
Headers:
  x-tenant-id: faraz
  Authorization: Bearer <admin_token>
Body:
{
  "pin": "123456"
}
```

This will:
- ✅ Generate new `pinKey` with current `PIN_PEPPER`
- ✅ Generate new `pinHash` with current `PIN_PEPPER`  
- ✅ Update tenant DB user document
- ✅ Sync to main DB PIN directory
- ✅ Clear any existing login failures/locks

### Step 4: Test PIN Login
```bash
POST /t/auth/login-pin
Body:
{
  "pin": "123456"
}

# Expected response:
{
  "status": 200,
  "message": "Login successful",
  "result": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { ... },
    "branchId": "...",
    "posId": "...",
    "requiresPosSelection": false,
    "availableTerminals": [...]
  }
}
```

---

## Verification Script

Use the provided script to diagnose PIN issues:

```bash
node scripts/verify-pin-setup.js 123456 6e208a40e5867d2f630729bcb044e450710729c2fc81774098fc34be64eb71cd
```

Output will show:
- ✅ Current PIN_PEPPER value and source
- ✅ Computed pinKey vs expected pinKey
- ✅ Match status (YES/NO)
- ✅ Environment variable status
- ✅ Recommendations for production

---

## Production Checklist

### Before Deployment
- [x] Code bugs fixed (JWT token, logger import, module path)
- [ ] Environment variables documented
- [ ] PIN_PEPPER value decided and secured
- [ ] JWT_SECRET_KEY value decided and secured
- [ ] Deployment plan reviewed

### During Deployment
- [ ] Pull latest code from main branch
- [ ] Set PIN_PEPPER in production environment
- [ ] Set JWT_SECRET_KEY in production environment
- [ ] Restart application (pm2 restart all)
- [ ] Verify no startup errors in logs

### After Deployment
- [ ] Re-set PIN for test staff account
- [ ] Test PIN login with test account
- [ ] Verify JWT token includes tenantSlug
- [ ] Test authenticated requests with PIN-generated token
- [ ] Re-set PINs for all production staff accounts
- [ ] Monitor logs for PIN login failures
- [ ] Document PIN_PEPPER value in secure location

---

## Security Recommendations

### 1. Environment Variables (CRITICAL)
```bash
# Generate secure values
PIN_PEPPER=$(openssl rand -hex 32)
JWT_SECRET_KEY=$(openssl rand -hex 32)

# Add to .env file
echo "PIN_PEPPER=$PIN_PEPPER" >> .env
echo "JWT_SECRET_KEY=$JWT_SECRET_KEY" >> .env

# Ensure .env is in .gitignore
echo ".env" >> .gitignore
```

### 2. PIN Complexity
Consider enforcing:
- Minimum 6 digits (currently allows any)
- No sequential numbers (123456, 111111)
- Regular rotation (every 90 days)

### 3. Monitoring
Add alerts for:
- Multiple failed PIN attempts from same IP
- PIN login failures > 10% of attempts
- Locked accounts (5 failed attempts)

### 4. Audit Trail
Consider logging:
- Successful PIN logins (user, IP, timestamp)
- Failed PIN attempts (pinKey hash, IP, timestamp)
- PIN changes (who, when, by whom)

---

## Architecture Overview

### PIN Storage (Dual-Database Approach)

**Main DB (`TenantPinDirectory` collection)**:
```javascript
{
  pinKey: "6e208a40...",        // HMAC-SHA256(PIN, PIN_PEPPER)
  tenantSlug: "faraz",          // Which tenant DB to connect to
  tenantUserId: ObjectId("..."), // User ID in tenant DB
  assignedBranchId: ObjectId("..."),
  posIds: [...],
  status: "active"
}
```

**Tenant DB (`TenantUser` collection)**:
```javascript
{
  _id: ObjectId("..."),
  pinHash: "$2a$12$...",         // bcrypt(PIN + PIN_PEPPER)
  pinKey: "6e208a40...",         // For uniqueness check
  isStaff: true,
  status: "active",
  assignedBranchId: ObjectId("..."),
  ...
}
```

### Login Flow
```
1. Client → POST /t/auth/login-pin { pin: "123456" }
2. Server → Compute pinKey = HMAC(PIN, PIN_PEPPER)
3. Server → Query main DB: TenantPinDirectory.findOne({ pinKey })
4. Server → Resolve tenant: Tenant.findOne({ slug: "faraz" })
5. Server → Connect to tenant DB
6. Server → Fetch user: TenantUser.findById(tenantUserId)
7. Server → Verify: bcrypt.compare(PIN + PIN_PEPPER, user.pinHash)
8. Server → Generate JWT with tenantSlug
9. Server → Return token to client
```

---

## Files Modified

### Core Logic
- `features/tenant-auth/services/TenantAuthService.js` - Fixed JWT token bug
- `features/staff/services/StaffService.js` - Added logger import
- `features/staff/controller/StaffController.js` - Pass tenantSlug to service

### New Files
- `features/tenant-auth/model/TenantPinDirectory.model.js` - Main DB schema
- `features/tenant-auth/repository/tenantPinDirectory.repository.js` - Main DB repo
- `scripts/verify-pin-setup.js` - Diagnostic tool
- `DEBUG-PIN-LOGIN.md` - Detailed debugging guide
- `CRITICAL-FIX-PIN-LOGIN.md` - This document

### Configuration
- `middlewares/Base.js` - Rate limiting for PIN login (10/15min)

---

## Support & Troubleshooting

### Common Errors

**"Invalid credentials"**
- Cause: PIN_PEPPER mismatch or wrong PIN
- Fix: Re-set PIN via API

**"Missing tenant identifier"**
- Cause: Old code (before fix)
- Fix: Deploy latest code

**"Account is not active"**
- Cause: User status != "active"
- Fix: `POST /t/staff/{id}/status { "status": "active" }`

**"PIN login is only available for staff accounts"**
- Cause: User.isStaff = false
- Fix: Ensure user created via Staff API

**"Cashier is not assigned to any branch"**
- Cause: User.assignedBranchId not set
- Fix: Update staff to assign branch

### Debug Commands

```bash
# Check PIN directory in main DB
mongo <main-db-uri>
db.tenantpindirectories.find().pretty()

# Check user in tenant DB
mongo <tenant-db-uri>
db.tenantusers.findOne({ _id: ObjectId("...") })

# Verify PIN computation
node scripts/verify-pin-setup.js 123456 <pinKey-from-db>

# Check application logs
pm2 logs tritech-pos-backend --lines 100
```

---

## Contact

For issues or questions:
1. Check `DEBUG-PIN-LOGIN.md` for detailed debugging steps
2. Run `scripts/verify-pin-setup.js` to diagnose environment issues
3. Review PM2 logs for runtime errors
4. Verify environment variables are set correctly

**Remember**: PIN_PEPPER and JWT_SECRET_KEY must remain constant in production!

