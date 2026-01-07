# 🚨 CRITICAL FIX: Tenant Resolution for Password Reset

## ❌ **The Problem**

The initial implementation incorrectly assumed tenant resolution from email domain:

```javascript
// ❌ WRONG APPROACH
const domain = emailParts[1]; // "restaurant.com"
const tenantSlug = domain.split('.')[0]; // "restaurant"
```

**Why This Doesn't Work:**
- ❌ You don't have separate domains per tenant
- ❌ Users use their own emails: `manager@gmail.com`, `owner@outlook.com`
- ❌ Cannot derive tenant from `gmail.com` or `outlook.com`

---

## ✅ **The Solution**

Use the existing **Main DB `TenantUserDirectory`** to map emails to tenants.

### **How It Works:**

```javascript
// ✅ CORRECT APPROACH
// 1. Look up email in Main DB directory
const directoryEntry = await TenantUserDirectoryRepo.findByEmail("manager@gmail.com");
// Returns: { tenantSlug: "restaurant-xyz", tenantUserId: "..." }

// 2. Use tenantSlug to connect to correct tenant DB
const tenant = await Tenant.findOne({ slug: "restaurant-xyz" });
const conn = await getTenantConnection(tenant.dbURI);

// 3. Verify user exists in tenant DB
const user = await TenantUserRepo.getByEmail(conn, "manager@gmail.com");
```

---

## 🔄 **What Was Changed**

### **File: `features/tenant-auth/services/TenantAuthService.js`**

#### **Before (WRONG):**
```javascript
static async requestPasswordResetOTP({ email }, metadata = {}) {
  const normalizedEmail = email.toLowerCase().trim();

  // ❌ Extract tenant from email domain
  const emailParts = normalizedEmail.split('@');
  const domain = emailParts[1];
  const tenantSlug = domain.split('.')[0]; // WRONG!
  
  // ...
}
```

#### **After (CORRECT):**
```javascript
static async requestPasswordResetOTP({ email }, metadata = {}) {
  const normalizedEmail = email.toLowerCase().trim();

  // ✅ Look up tenant from Main DB directory
  const directoryEntry = await TenantUserDirectoryRepo.findByEmail(normalizedEmail);
  
  if (!directoryEntry) {
    return {
      status: 200,
      message: 'If an account exists with this email, an OTP has been sent.'
    };
  }

  const tenantSlug = directoryEntry.tenantSlug; // CORRECT!
  
  // ...
}
```

---

## 📊 **TenantUserDirectory Schema**

**Collection:** `TenantUserDirectory` (Main DB)

```javascript
{
  emailLower: "manager@gmail.com",      // Normalized email
  tenantSlug: "restaurant-xyz",         // Which tenant they belong to
  tenantUserId: ObjectId("..."),        // User ID in tenant DB
  userType: "staff" | "owner",          // User role
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

**Indexes:**
- `emailLower` (unique) - Fast email lookup
- `{ tenantSlug, tenantUserId }` (unique) - Prevent duplicates

---

## 🔄 **When is Directory Populated?**

The directory is **automatically populated** when:

### 1. **Tenant Creation (Owner)**
```javascript
// features/tenant/services/TenantService.js
static async create({ ownerEmail, ... }) {
  // Create owner in tenant DB
  const owner = await TenantUserRepo.create(conn, { ... });
  
  // ✅ Add to Main DB directory
  await TenantUserDirectoryRepo.upsertByEmail({
    email: ownerEmail,
    tenantSlug: slug,
    tenantUserId: owner._id,
    userType: 'owner'
  });
}
```

### 2. **Staff Creation**
```javascript
// features/staff/services/StaffService.js
static async create(conn, payload, tenantSlug) {
  // Create staff in tenant DB
  const staff = await TenantUserRepo.create(conn, { ... });
  
  // ✅ Add to Main DB directory
  await TenantUserDirectoryRepo.upsertByEmail({
    email: staff.email,
    tenantSlug: tenantSlug,
    tenantUserId: staff._id,
    userType: 'staff'
  });
}
```

### 3. **Staff Email Update**
```javascript
// features/staff/services/StaffService.js
static async update(conn, id, payload, tenantSlug) {
  // Update staff in tenant DB
  const staff = await TenantUserRepo.updateById(conn, id, payload);
  
  // ✅ Update Main DB directory
  if (payload.email) {
    await TenantUserDirectoryRepo.upsertByEmail({
      email: payload.email,
      tenantSlug: tenantSlug,
      tenantUserId: staff._id,
      userType: 'staff'
    });
  }
}
```

---

## 🧪 **Testing the Fix**

### **Test Case 1: Tenant User Password Reset**

```bash
# 1. Create tenant with owner
POST /tenants
{
  "name": "My Restaurant",
  "slug": "my-restaurant",
  "ownerEmail": "owner@gmail.com",
  "ownerPassword": "Password123!"
}

# ✅ Directory entry created automatically:
# { emailLower: "owner@gmail.com", tenantSlug: "my-restaurant", ... }

# 2. Request password reset
POST /t/auth/password-reset/request-otp
{
  "email": "owner@gmail.com"
}

# ✅ Backend looks up email in directory
# ✅ Finds tenantSlug: "my-restaurant"
# ✅ Connects to correct tenant DB
# ✅ Sends OTP email

# 3. Verify OTP
POST /t/auth/password-reset/verify-otp
{
  "email": "owner@gmail.com",
  "otp": "123456"
}

# 4. Reset password
POST /t/auth/password-reset/reset
{
  "email": "owner@gmail.com",
  "password": "NewPassword123!"
}

# ✅ Password updated in correct tenant DB
```

### **Test Case 2: Staff Member Password Reset**

```bash
# 1. Create staff
POST /t/staff
Headers: { x-tenant-id: "my-restaurant" }
{
  "fullName": "John Manager",
  "email": "manager@gmail.com",
  "roles": ["manager"]
}

# ✅ Directory entry created automatically:
# { emailLower: "manager@gmail.com", tenantSlug: "my-restaurant", ... }

# 2. Request password reset
POST /t/auth/password-reset/request-otp
{
  "email": "manager@gmail.com"
}

# ✅ Works correctly!
```

### **Test Case 3: Non-Existent Email**

```bash
POST /t/auth/password-reset/request-otp
{
  "email": "nonexistent@gmail.com"
}

# Response (generic message for security):
{
  "status": 200,
  "message": "If an account exists with this email, an OTP has been sent."
}

# ✅ No OTP sent (user doesn't exist)
# ✅ No error revealed (security best practice)
```

---

## 📝 **Files Changed**

### **Modified:**
1. `features/tenant-auth/services/TenantAuthService.js`
   - `requestPasswordResetOTP()` - Fixed tenant resolution
   - `verifyPasswordResetOTP()` - Fixed tenant resolution
   - `resetPasswordWithOTP()` - Already correct (uses OTP record's tenantSlug)

### **Documentation Updated:**
1. `docs/PASSWORD_RESET_OTP.md` - Updated multi-tenant description
2. `docs/PASSWORD_RESET_OTP_QUICK_START.md` - Updated tenant resolution note
3. `postman/Password_Reset_OTP.postman_collection.json` - Updated descriptions

### **New Documentation:**
1. `docs/PASSWORD_RESET_OTP_TENANT_RESOLUTION.md` - Detailed technical guide
2. `CRITICAL-FIX-TENANT-RESOLUTION.md` - This document

---

## ✅ **Benefits of This Fix**

1. **Works with Any Email**
   - Gmail, Outlook, Yahoo, custom domains - all supported
   - No dependency on email domain structure

2. **Already Implemented**
   - `TenantUserDirectory` already exists in your system
   - Used for login tenant resolution
   - No new infrastructure needed

3. **Automatic Sync**
   - Directory updated when users are created/updated
   - No manual maintenance required

4. **Secure**
   - User enumeration protection maintained
   - Tenant isolation preserved
   - Double verification (directory + tenant DB)

5. **Consistent**
   - Same approach as PIN login and regular login
   - Follows existing system patterns

---

## 🔍 **Verification Checklist**

- [x] Code updated to use `TenantUserDirectoryRepo`
- [x] Removed email domain parsing logic
- [x] Security (user enumeration protection) maintained
- [x] Documentation updated
- [x] Postman collection updated
- [x] No linting errors
- [ ] **Manual testing required** (by user)

---

## 🚀 **Deployment Notes**

### **No Database Migration Needed**
- `TenantUserDirectory` collection already exists
- Already populated for existing users
- New users will be added automatically

### **Backward Compatible**
- No breaking changes
- Existing OTP flow unchanged
- Only tenant resolution logic updated

### **Testing in Production**
1. Test with existing tenant user email
2. Verify OTP is sent
3. Verify password reset works
4. Test with non-existent email (should return generic message)

---

## 📞 **Support**

If you encounter issues:

1. **Check directory entry exists:**
   ```javascript
   // In MongoDB shell (Main DB)
   db.tenantuserdirectories.findOne({ emailLower: "user@gmail.com" })
   ```

2. **Manually add if missing:**
   ```javascript
   await TenantUserDirectoryRepo.upsertByEmail({
     email: "user@gmail.com",
     tenantSlug: "your-tenant-slug",
     tenantUserId: ObjectId("user-id-from-tenant-db"),
     userType: "staff"
   });
   ```

3. **Review logs:**
   - Check for "OTP requested for tenant user: ..." log entries
   - Verify tenant resolution is working

---

## 📚 **Related Documentation**

- [Password Reset OTP - Complete Guide](./docs/PASSWORD_RESET_OTP.md)
- [Tenant Resolution Technical Details](./docs/PASSWORD_RESET_OTP_TENANT_RESOLUTION.md)
- [JWT Tenant Resolution](./docs/JWT-TENANT-RESOLUTION.md)

---

**Issue Identified:** January 7, 2026  
**Fixed:** January 7, 2026  
**Status:** ✅ **RESOLVED**  
**Version:** 1.0.1

