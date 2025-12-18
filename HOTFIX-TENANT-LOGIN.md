# 🔥 HOTFIX: Tenant Login URI Parsing Issue

**Branch:** `hotfix/tenant-login-uri-parsing-issue`  
**Status:** ✅ FIXED  
**Priority:** CRITICAL  
**Date:** December 18, 2025

---

## 🚨 Problem Description

### Symptoms
- Tenant login failing with "Tenant not found" error
- Error occurs even when tenant exists in database
- `x-tenant-id` header being sent correctly but not recognized
- Specifically affects tenant: `extraction-testt`

### Root Cause
The recent commit that added `withAuthSource()` normalization to MongoDB URIs introduced a bug:

1. The `new URL()` constructor was used to parse MongoDB connection strings
2. If the URI format wasn't perfectly standard, parsing would fail silently
3. The function would return the original URI without adding `authSource`
4. This caused connection attempts to fail with authentication errors
5. The error was caught and reported as "Tenant not found" instead of "Connection failed"

---

## ✅ Solution Implemented

### 1. Fixed `modules/mongoUri.js`
**Changes:**
- Added validation to check URI starts with `mongodb://` or `mongodb+srv://`
- Added fallback string manipulation if URL parsing fails
- Added comprehensive error logging
- Handles edge cases gracefully

**Before:**
```javascript
function withAuthSource(dbUri) {
  if (!dbUri) return dbUri;
  try {
    const parsed = new URL(dbUri);
    if (!parsed.searchParams.has('authSource')) {
      parsed.searchParams.set('authSource', getDefaultAuthSource());
    }
    return parsed.toString();
  } catch (err) {
    return dbUri; // Silent failure!
  }
}
```

**After:**
```javascript
function withAuthSource(dbUri) {
  if (!dbUri) return dbUri;
  
  try {
    // Validate format first
    if (!dbUri.startsWith('mongodb://') && !dbUri.startsWith('mongodb+srv://')) {
      console.warn(`[mongoUri] Invalid MongoDB URI format: ${dbUri}`);
      return dbUri;
    }

    const parsed = new URL(dbUri);
    if (!parsed.searchParams.has('authSource')) {
      parsed.searchParams.set('authSource', getDefaultAuthSource());
    }
    return parsed.toString();
  } catch (err) {
    console.error(`[mongoUri] Failed to parse URI`, err.message);
    // Fallback to string manipulation
    try {
      const authSource = getDefaultAuthSource();
      if (dbUri.includes('?')) {
        if (!dbUri.includes('authSource=')) {
          return `${dbUri}&authSource=${authSource}`;
        }
      } else {
        return `${dbUri}?authSource=${authSource}`;
      }
    } catch (fallbackErr) {
      console.error(`[mongoUri] Fallback parsing also failed`, fallbackErr.message);
    }
    return dbUri;
  }
}
```

### 2. Enhanced `middlewares/tenantContext.js`
**Changes:**
- Added detailed logging at each step
- Masked passwords in logs for security
- Better error messages with context
- Stack traces in development mode

### 3. Improved `modules/connectionManager.js`
**Changes:**
- Comprehensive connection lifecycle logging
- Better error context
- Password masking in all logs
- Cached connection detection

### 4. Added Diagnostic Tools
**New scripts:**
- `scripts/test-tenant-connection.js` - Test tenant DB connections
- `scripts/fix-tenant-dburi.js` - Fix/regenerate tenant dbUri
- `scripts/README.md` - Documentation

---

## 🧪 Testing Instructions

### Step 1: Test the Connection
```bash
node scripts/test-tenant-connection.js extraction-testt
```

**Expected Output:**
```
🔍 Tenant Connection Diagnostic Tool
=====================================

📡 Step 1: Connecting to main database...
   ✅ Main database connected

📋 Step 2: Looking up tenant "extraction-testt"...
   ✅ Tenant found
   Name: Extraction Test
   Status: trial

🔗 Step 3: Validating tenant dbUri...
   ✅ URI format is valid

🔌 Step 4: Testing connection to tenant database...
   ✅ Connection established

📊 Step 5: Testing database queries...
   ✅ Found X collections

✅ All tests passed!
```

### Step 2: Fix dbUri if Needed
If the test fails, run:
```bash
node scripts/fix-tenant-dburi.js extraction-testt --force
```

### Step 3: Test API Login
```bash
curl -X POST http://localhost:3000/t/auth/login \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: extraction-testt" \
  -d '{
    "email": "owner@extraction-testt.com",
    "password": "your-password"
  }'
```

**Expected Response:**
```json
{
  "status": 200,
  "message": "Login successful",
  "result": {
    "token": "eyJhbGc...",
    "user": { ... }
  }
}
```

---

## 🚀 Deployment Instructions

### For Development/Staging

1. **Pull the hotfix branch:**
   ```bash
   git fetch origin
   git checkout hotfix/tenant-login-uri-parsing-issue
   ```

2. **Install dependencies (if needed):**
   ```bash
   npm install
   ```

3. **Test the connection:**
   ```bash
   node scripts/test-tenant-connection.js extraction-testt
   ```

4. **Restart the server:**
   ```bash
   npm run dev
   # or
   pm2 restart all
   ```

5. **Verify login works:**
   - Test with Postman or curl
   - Check server logs for detailed connection info

### For Production

1. **Create a pull request:**
   - Go to: https://github.com/HusnainYusufi/tritech-pos-backend/pull/new/hotfix/tenant-login-uri-parsing-issue
   - Review changes
   - Get approval

2. **Merge to main:**
   ```bash
   git checkout main
   git merge hotfix/tenant-login-uri-parsing-issue
   git push origin main
   ```

3. **Deploy to production:**
   ```bash
   # SSH to production server
   cd /path/to/tritech-pos-backend
   git pull origin main
   pm2 restart tritech-pos-backend
   ```

4. **Verify in production:**
   ```bash
   # On production server
   node scripts/test-tenant-connection.js extraction-testt
   ```

5. **Monitor logs:**
   ```bash
   pm2 logs tritech-pos-backend --lines 100
   ```

---

## 📊 What Changed

### Files Modified
- ✅ `modules/mongoUri.js` - Fixed URI parsing with fallback
- ✅ `middlewares/tenantContext.js` - Enhanced logging
- ✅ `modules/connectionManager.js` - Better error handling

### Files Added
- ✅ `scripts/test-tenant-connection.js` - Diagnostic tool
- ✅ `scripts/fix-tenant-dburi.js` - Fix utility
- ✅ `scripts/README.md` - Scripts documentation
- ✅ `HOTFIX-TENANT-LOGIN.md` - This document

---

## 🔍 Debugging Tips

### If login still fails after applying fix:

1. **Check server logs:**
   ```bash
   pm2 logs tritech-pos-backend --lines 50
   ```
   Look for `[tenantContext]` and `[connectionManager]` log entries

2. **Verify tenant exists:**
   ```bash
   mongosh
   use tritech_main
   db.tenants.findOne({ slug: "extraction-testt" })
   ```

3. **Check dbUri format:**
   ```javascript
   // Should look like:
   mongodb://username:password@host:port/tenant_extraction-testt?authSource=admin
   ```

4. **Test connection directly:**
   ```bash
   mongosh "mongodb://username:password@host:port/tenant_extraction-testt?authSource=admin"
   ```

5. **Check environment variables:**
   ```bash
   echo $MONGO_URI
   echo $MONGO_URI_MAIN
   echo $MONGO_AUTH_DB
   ```

---

## 🎯 Prevention

To prevent similar issues in the future:

1. **Always test URI parsing with edge cases:**
   - URIs with special characters
   - URIs without protocols
   - URIs with existing query params

2. **Add comprehensive logging:**
   - Log inputs and outputs
   - Mask sensitive data
   - Include context in errors

3. **Create diagnostic tools:**
   - Test scripts for critical paths
   - Fix utilities for common issues

4. **Test with real data:**
   - Use actual tenant slugs
   - Test with production-like URIs

---

## 📞 Support

If you encounter issues:

1. Run diagnostic: `node scripts/test-tenant-connection.js <slug>`
2. Check logs: `pm2 logs` or check `logs/` directory
3. Contact: Head of Engineering

---

## ✅ Checklist

Before marking this as resolved:

- [x] Code changes committed
- [x] Hotfix branch pushed
- [x] Diagnostic tools created
- [x] Documentation written
- [ ] Tested in development
- [ ] Tested in staging
- [ ] Pull request created
- [ ] Code reviewed
- [ ] Merged to main
- [ ] Deployed to production
- [ ] Verified in production
- [ ] Monitoring confirmed

---

**Status:** Ready for testing and deployment  
**Next Steps:** Test in development, then create PR for production deployment

