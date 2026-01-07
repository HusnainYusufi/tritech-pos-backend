# Tenant Resolution for Password Reset - Technical Details

## 🎯 The Challenge

In a multi-tenant system **without separate domains per tenant**, how do we know which tenant database to connect to when a user requests a password reset?

### ❌ **What Doesn't Work**

**Domain-based resolution:**
```javascript
// ❌ WRONG - Assumes separate domains per tenant
user@restaurant.com → tenant: "restaurant"
user@cafe.com → tenant: "cafe"
```

**Problem:** In your system, all users use their own email addresses:
- `manager@gmail.com` (could be any tenant)
- `owner@outlook.com` (could be any tenant)
- `staff@yahoo.com` (could be any tenant)

---

## ✅ **The Solution: TenantUserDirectory**

We use the **Main DB `TenantUserDirectory`** collection to map emails to tenants.

### **Database Schema**

**Collection:** `TenantUserDirectory` (Main DB)

```javascript
{
  emailLower: "manager@gmail.com",
  tenantSlug: "restaurant-xyz",
  tenantUserId: ObjectId("..."),
  userType: "staff",
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

### **How It Works**

```
┌─────────────────────────────────────────────────────────────────┐
│                    TENANT RESOLUTION FLOW                        │
└─────────────────────────────────────────────────────────────────┘

Step 1: User enters email
┌──────────────────────────┐
│  manager@gmail.com       │
└──────────────────────────┘
            │
            ▼
Step 2: Look up in Main DB TenantUserDirectory
┌──────────────────────────────────────────────────────────┐
│  Main DB → TenantUserDirectory Collection                │
│  ┌────────────────────────────────────────────────────┐  │
│  │  {                                                 │  │
│  │    emailLower: "manager@gmail.com",               │  │
│  │    tenantSlug: "restaurant-xyz",                  │  │
│  │    tenantUserId: ObjectId("...")                  │  │
│  │  }                                                 │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
            │
            ▼
Step 3: Resolve tenant
┌──────────────────────────┐
│  tenantSlug: "restaurant-xyz"
└──────────────────────────┘
            │
            ▼
Step 4: Connect to tenant DB
┌──────────────────────────────────────────────────────────┐
│  Tenant DB: restaurant_xyz_db                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │  TenantUser Collection                             │  │
│  │  {                                                 │  │
│  │    email: "manager@gmail.com",                    │  │
│  │    passwordHash: "$2a$10$...",                    │  │
│  │    ...                                            │  │
│  │  }                                                 │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
            │
            ▼
Step 5: Create OTP in Main DB
┌──────────────────────────────────────────────────────────┐
│  Main DB → PasswordResetOTP Collection                   │
│  ┌────────────────────────────────────────────────────┐  │
│  │  {                                                 │  │
│  │    email: "manager@gmail.com",                    │  │
│  │    otpHash: "$2a$10$...",                         │  │
│  │    userType: "tenant",                            │  │
│  │    tenantSlug: "restaurant-xyz"                   │  │
│  │  }                                                 │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## 🔄 **When is TenantUserDirectory Populated?**

The directory is automatically populated when:

### 1. **Tenant Owner Registration**
```javascript
// features/tenant/services/TenantService.js
static async create({ name, slug, ownerEmail, ownerPassword, ... }) {
  // ... create tenant ...
  
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
  if (staff.email) {
    await TenantUserDirectoryRepo.upsertByEmail({
      email: staff.email,
      tenantSlug: tenantSlug,
      tenantUserId: staff._id,
      userType: 'staff'
    });
  }
}
```

### 3. **Staff Email Update**
```javascript
// features/staff/services/StaffService.js
static async update(conn, id, payload, tenantSlug) {
  // Update staff in tenant DB
  const staff = await TenantUserRepo.updateById(conn, id, payload);
  
  // ✅ Update Main DB directory if email changed
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

## 📊 **Complete Password Reset Flow**

### **For Tenant Users:**

```javascript
// 1. Request OTP
POST /t/auth/password-reset/request-otp
{
  "email": "manager@gmail.com"
}

// Backend Process:
// a. Look up email in TenantUserDirectory (Main DB)
const directory = await TenantUserDirectoryRepo.findByEmail("manager@gmail.com");
// → { tenantSlug: "restaurant-xyz", tenantUserId: "..." }

// b. Resolve tenant
const tenant = await Tenant.findOne({ slug: "restaurant-xyz" });

// c. Connect to tenant DB
const conn = await getTenantConnection(tenant.dbURI);

// d. Verify user exists
const user = await TenantUserRepo.getByEmail(conn, "manager@gmail.com");

// e. Create OTP in Main DB
await OTPService.requestOTP("manager@gmail.com", "tenant", "restaurant-xyz");

// f. Send email with OTP
```

---

## 🔐 **Security Considerations**

### 1. **User Enumeration Protection**
Even if email is not in directory, we return a generic success message:

```javascript
if (!directoryEntry) {
  // Don't reveal if user exists or not
  return {
    status: 200,
    message: 'If an account exists with this email, an OTP has been sent.'
  };
}
```

### 2. **Double Verification**
We verify user exists in both:
1. **Main DB directory** (for tenant resolution)
2. **Tenant DB** (for actual user validation)

### 3. **Tenant Isolation**
Each tenant's data is completely isolated:
- OTP record stores `tenantSlug` for reference
- Password reset only updates the correct tenant DB
- No cross-tenant data leakage

---

## 🆚 **Comparison: Admin vs Tenant**

| Aspect | Admin Users | Tenant Users |
|--------|-------------|--------------|
| **Database** | Main DB only | Tenant-specific DB |
| **Tenant Resolution** | Not needed | Via TenantUserDirectory |
| **OTP Storage** | Main DB | Main DB |
| **Password Storage** | Main DB (User collection) | Tenant DB (TenantUser collection) |
| **Email Lookup** | Direct (Main DB) | Directory → Tenant DB |

---

## 🧪 **Testing the Flow**

### **Scenario 1: Tenant User Password Reset**

```bash
# 1. Create a tenant and staff
POST /tenants
{
  "name": "My Restaurant",
  "slug": "my-restaurant",
  "ownerEmail": "owner@gmail.com",
  "ownerPassword": "Password123!"
}

# 2. Create staff
POST /t/staff
Headers: { x-tenant-id: "my-restaurant" }
{
  "fullName": "John Manager",
  "email": "manager@gmail.com",
  "roles": ["manager"]
}

# 3. Verify directory entry was created
# Main DB → TenantUserDirectory
{
  emailLower: "manager@gmail.com",
  tenantSlug: "my-restaurant",
  tenantUserId: ObjectId("..."),
  userType: "staff"
}

# 4. Request password reset
POST /t/auth/password-reset/request-otp
{
  "email": "manager@gmail.com"
}

# ✅ Backend resolves tenant from directory
# ✅ Connects to correct tenant DB
# ✅ Sends OTP email
```

### **Scenario 2: Email Not in Directory**

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

## 📝 **Code Implementation**

### **Updated TenantAuthService.js**

```javascript
/**
 * Request OTP for tenant password reset
 * Tenant is resolved from Main DB TenantUserDirectory
 */
static async requestPasswordResetOTP({ email }, metadata = {}) {
  const normalizedEmail = email.toLowerCase().trim();

  // ✅ Look up tenant from Main DB directory
  const directoryEntry = await TenantUserDirectoryRepo.findByEmail(normalizedEmail);
  
  if (!directoryEntry) {
    // Don't reveal if user exists or not (security best practice)
    return {
      status: 200,
      message: 'If an account exists with this email, an OTP has been sent.'
    };
  }

  const tenantSlug = directoryEntry.tenantSlug;

  // Verify tenant exists
  const tenant = await Tenant.findOne({ slug: tenantSlug });
  if (!tenant) {
    return {
      status: 200,
      message: 'If an account exists with this email, an OTP has been sent.'
    };
  }

  // Connect to tenant DB
  const conn = await getTenantConnection(tenant.dbURI);

  // Check if user exists
  const userDoc = await TenantUserRepo.getByEmail(conn, normalizedEmail);
  if (!userDoc) {
    return {
      status: 200,
      message: 'If an account exists with this email, an OTP has been sent.'
    };
  }

  // Request OTP
  return await OTPService.requestOTP(normalizedEmail, 'tenant', tenantSlug, metadata);
}
```

---

## ✅ **Benefits of This Approach**

1. **Works with Any Email Provider**
   - Gmail, Outlook, Yahoo, custom domains - all supported
   - No dependency on email domain structure

2. **Centralized Lookup**
   - Single source of truth in Main DB
   - Fast tenant resolution (indexed lookup)

3. **Automatic Sync**
   - Directory updated when users are created/updated
   - No manual maintenance required

4. **Secure**
   - User enumeration protection
   - Tenant isolation maintained
   - Double verification (directory + tenant DB)

5. **Scalable**
   - Works for unlimited tenants
   - Efficient database queries
   - No performance degradation

---

## 🔍 **Troubleshooting**

### **Issue: "User not found" but user exists**

**Cause:** Email not in TenantUserDirectory

**Solution:**
```javascript
// Manually add to directory
await TenantUserDirectoryRepo.upsertByEmail({
  email: "user@gmail.com",
  tenantSlug: "my-tenant",
  tenantUserId: ObjectId("..."),
  userType: "staff"
});
```

### **Issue: Wrong tenant resolved**

**Cause:** Directory entry points to wrong tenant

**Solution:**
```javascript
// Update directory entry
await TenantUserDirectoryRepo.upsertByEmail({
  email: "user@gmail.com",
  tenantSlug: "correct-tenant",  // ← Fix this
  tenantUserId: ObjectId("..."),
  userType: "staff"
});
```

---

## 📚 **Related Documentation**

- [JWT Tenant Resolution](./JWT-TENANT-RESOLUTION.md)
- [Password Reset OTP](./PASSWORD_RESET_OTP.md)
- [Cashier Authentication](./CASHIER-AUTHENTICATION-ARCHITECTURE.md)

---

**Last Updated:** January 7, 2026  
**Version:** 1.0.1 (Fixed tenant resolution)  
**Author:** Tritech Backend Team

