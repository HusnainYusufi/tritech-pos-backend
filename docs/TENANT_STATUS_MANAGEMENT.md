# Tenant Status Management

## 📋 Overview

The system has a **tenant status** field that controls tenant access and billing state.

---

## 🎯 **Tenant Status Values**

| Status | Description | Access | Use Case |
|--------|-------------|--------|----------|
| **trial** | Free trial period | ✅ Full access | New tenant onboarding |
| **paid** | Active paying customer | ✅ Full access | Normal operation |
| **unpaid** | Payment overdue | ⚠️ Limited access | Grace period |
| **suspended** | Admin suspended | ❌ No access | Violation, non-payment, admin action |

---

## 🔐 **Status Enforcement**

### **Where Status is Checked:**

#### 1. **Password Reset (OTP)**
```javascript
// Suspended tenants cannot reset passwords
if (tenant.status === 'suspended') {
  throw new AppError('This account has been suspended. Please contact support.', 403);
}
```

#### 2. **Login (Regular & PIN)**
```javascript
// Should check tenant status during login
// (Recommended to add)
```

#### 3. **API Access**
```javascript
// Middleware should check tenant status
// (Recommended to add)
```

---

## 📡 **Admin API Endpoints**

### **1. Get All Tenants**

```http
GET /admin/tenants?status=suspended
Authorization: Bearer <admin_token>
```

**Query Parameters:**
- `status` - Filter by status: `trial`, `paid`, `unpaid`, `suspended`
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `search` - Search by name or email

**Response:**
```json
{
  "status": 200,
  "message": "Tenants retrieved successfully",
  "data": [
    {
      "_id": "tenant_123",
      "name": "My Restaurant",
      "slug": "my-restaurant",
      "status": "paid",
      "planId": "plan_456",
      "contactEmail": "owner@restaurant.com",
      "registrationDate": "2026-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50
  }
}
```

---

### **2. Update Tenant Status**

```http
PUT /admin/tenants/:tenantId
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "status": "suspended"
}
```

**Request Body:**
```json
{
  "status": "suspended",  // or "paid", "unpaid", "trial"
  "name": "Updated Name",  // optional
  "contactEmail": "new@email.com"  // optional
}
```

**Response:**
```json
{
  "status": 200,
  "message": "Tenant updated successfully",
  "data": {
    "_id": "tenant_123",
    "name": "My Restaurant",
    "slug": "my-restaurant",
    "status": "suspended",
    "lastUpdatedAt": "2026-01-07T12:00:00.000Z"
  }
}
```

---

### **3. Change Tenant Plan**

```http
POST /admin/tenants/:tenantId/change-plan
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "planId": "plan_456"
}
```

**Response:**
```json
{
  "status": 200,
  "message": "Plan changed",
  "result": {
    "_id": "tenant_123",
    "planId": "plan_456",
    "status": "paid"  // Auto-updated based on plan type
  }
}
```

---

## 🔄 **Status Lifecycle**

```
┌─────────────────────────────────────────────────────────────┐
│                    TENANT STATUS LIFECYCLE                   │
└─────────────────────────────────────────────────────────────┘

1. NEW TENANT
   ↓
   status: "trial"
   ↓
   
2. TRIAL PERIOD (e.g., 14 days)
   ↓
   
3. SUBSCRIPTION STARTED
   ↓
   status: "paid"
   ↓
   
4. PAYMENT FAILED
   ↓
   status: "unpaid"
   ↓
   Grace Period (e.g., 7 days)
   ↓
   
5. STILL UNPAID
   ↓
   status: "suspended"
   ↓
   ❌ No Access
   
6. PAYMENT RECEIVED
   ↓
   status: "paid"
   ↓
   ✅ Access Restored

OR

ADMIN ACTION
   ↓
   status: "suspended"
   ↓
   ❌ No Access
```

---

## 🚨 **Suspended Tenant Behavior**

When a tenant is **suspended**, the following happens:

### **❌ Blocked Actions:**
1. **Password Reset**
   ```json
   {
     "status": 403,
     "message": "This account has been suspended. Please contact support."
   }
   ```

2. **Login** (Recommended to add)
   - Regular login should be blocked
   - PIN login should be blocked

3. **API Access** (Recommended to add)
   - All tenant API endpoints should return 403

### **✅ Allowed Actions:**
- Admin can still view tenant data
- Admin can update tenant status
- Admin can delete tenant

---

## 🛠️ **Implementation Recommendations**

### **1. Add Tenant Status Middleware**

Create a middleware to check tenant status on all tenant routes:

```javascript
// middlewares/checkTenantStatus.js
async function checkTenantStatus(req, res, next) {
  try {
    const tenantSlug = req.tenantSlug;
    if (!tenantSlug) return next();

    const tenant = await Tenant.findOne({ slug: tenantSlug });
    
    if (!tenant) {
      return res.status(404).json({
        status: 404,
        message: 'Tenant not found'
      });
    }

    if (tenant.status === 'suspended') {
      return res.status(403).json({
        status: 403,
        message: 'This account has been suspended. Please contact support.'
      });
    }

    // Optionally warn for unpaid status
    if (tenant.status === 'unpaid') {
      req.tenantWarning = 'Your account payment is overdue. Please update your payment method.';
    }

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = checkTenantStatus;
```

**Usage:**
```javascript
// Apply to all tenant routes
app.use('/t', checkTenantStatus);
```

---

### **2. Add Status Check to Login**

```javascript
// features/tenant-auth/services/TenantAuthService.js
static async login(conn, { email, password }, tenantSlug) {
  // ... existing code ...

  // Check tenant status
  const tenant = await Tenant.findOne({ slug: tenantSlug });
  if (tenant.status === 'suspended') {
    throw new AppError('This account has been suspended. Please contact support.', 403);
  }

  // ... rest of login logic ...
}
```

---

### **3. Add Status Check to PIN Login**

```javascript
// features/tenant-auth/services/TenantAuthService.js
static async loginWithPin(conn, { pin, terminalId }, tenantSlug) {
  // ... existing code ...

  // Check tenant status
  const tenant = await Tenant.findOne({ slug: tenantSlug });
  if (tenant.status === 'suspended') {
    throw new AppError('This account has been suspended. Please contact support.', 403);
  }

  // ... rest of PIN login logic ...
}
```

---

## 📊 **Database Schema**

```javascript
// Tenant Model
{
  _id: ObjectId("..."),
  name: "My Restaurant",
  slug: "my-restaurant",
  dbUri: "mongodb://localhost:27017/tenant_my_restaurant",
  
  // Status field
  status: "paid",  // "trial" | "paid" | "unpaid" | "suspended"
  
  planId: ObjectId("..."),
  contactEmail: "owner@restaurant.com",
  contactPhone: "+1234567890",
  registrationDate: ISODate("2026-01-01T00:00:00.000Z"),
  lastUpdatedAt: ISODate("2026-01-07T12:00:00.000Z")
}
```

---

## 🧪 **Testing**

### **Test Case 1: Suspend Tenant**

```bash
# 1. Suspend tenant
PUT /admin/tenants/tenant_123
Authorization: Bearer <admin_token>
{
  "status": "suspended"
}

# 2. Try to login as tenant user
POST /t/auth/login
{
  "email": "user@restaurant.com",
  "password": "Password123!"
}

# Expected: 403 Forbidden
{
  "status": 403,
  "message": "This account has been suspended. Please contact support."
}

# 3. Try password reset
POST /t/auth/password-reset/request-otp
{
  "email": "user@restaurant.com"
}

# Expected: 403 Forbidden
{
  "status": 403,
  "message": "This account has been suspended. Please contact support."
}
```

### **Test Case 2: Reactivate Tenant**

```bash
# 1. Reactivate tenant
PUT /admin/tenants/tenant_123
Authorization: Bearer <admin_token>
{
  "status": "paid"
}

# 2. Try to login again
POST /t/auth/login
{
  "email": "user@restaurant.com",
  "password": "Password123!"
}

# Expected: 200 OK (login successful)
```

---

## 📝 **Postman Collection**

Add these requests to your admin Postman collection:

### **1. Get All Tenants**
```
GET {{base_url}}/admin/tenants
Headers:
  Authorization: Bearer {{admin_token}}
```

### **2. Get Suspended Tenants**
```
GET {{base_url}}/admin/tenants?status=suspended
Headers:
  Authorization: Bearer {{admin_token}}
```

### **3. Suspend Tenant**
```
PUT {{base_url}}/admin/tenants/{{tenant_id}}
Headers:
  Authorization: Bearer {{admin_token}}
  Content-Type: application/json
Body:
{
  "status": "suspended"
}
```

### **4. Reactivate Tenant**
```
PUT {{base_url}}/admin/tenants/{{tenant_id}}
Headers:
  Authorization: Bearer {{admin_token}}
  Content-Type: application/json
Body:
{
  "status": "paid"
}
```

---

## 🎯 **Summary**

| Feature | Status | Notes |
|---------|--------|-------|
| **Tenant Status Field** | ✅ Exists | `trial`, `paid`, `unpaid`, `suspended` |
| **Admin API to Update Status** | ✅ Exists | `PUT /admin/tenants/:id` |
| **Password Reset Check** | ✅ Implemented | Blocks suspended tenants |
| **Login Check** | ⚠️ Recommended | Should add |
| **API Middleware Check** | ⚠️ Recommended | Should add |

---

## 📚 **Related Documentation**

- [Password Reset OTP](./PASSWORD_RESET_OTP.md)
- [Tenant Resolution](./PASSWORD_RESET_OTP_TENANT_RESOLUTION.md)
- [JWT Tenant Resolution](./JWT-TENANT-RESOLUTION.md)

---

**Last Updated:** January 7, 2026  
**Version:** 1.0.0  
**Author:** Tritech Backend Team

