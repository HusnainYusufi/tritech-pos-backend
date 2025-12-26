# 🔐 Cashier Authentication Architecture

## 📋 Overview

This document describes the **secure, streamlined cashier authentication system** for the POS application. The architecture ensures that cashiers are automatically routed to their assigned branch and POS terminals without manual selection.

---

## 🎯 Design Principles

### **Core Principle: "One Cashier, One Branch, One PIN"**

1. **Security First**: 6-digit PIN unique across the tenant
2. **Zero Manual Selection**: Cashier enters PIN only - system auto-routes
3. **Strict Assignment**: Each cashier assigned to exactly one branch
4. **Flexible POS Access**: Optional POS restrictions per cashier
5. **Audit Trail**: All login attempts tracked

---

## 🏗️ Architecture Components

### **1. Data Model**

```javascript
TenantUser Schema {
  // Identity
  fullName: String
  email: String (unique)
  
  // Authentication
  passwordHash: String
  pinHash: String
  pinKey: String (unique, indexed) // HMAC-SHA256 fingerprint for uniqueness
  
  // Staff Properties
  isStaff: Boolean
  position: String
  
  // 🔒 CASHIER ASSIGNMENT (NEW)
  assignedBranchId: ObjectId (ref: Branch)  // Primary branch - REQUIRED for cashiers
  posIds: [ObjectId] (ref: PosTerminal)     // POS restrictions (empty = any POS in branch)
  
  // Legacy multi-branch access (for managers/admins)
  branchIds: [ObjectId]
  
  // Security
  pinLoginFailures: Number
  pinLockedUntil: Date
  lastPinLoginAt: Date
  status: 'active' | 'suspended'
}
```

### **2. PIN Security**

#### **Format**
- **Exactly 6 digits** (enforced by validation)
- Example: `123456`, `987654`

#### **Storage**
```javascript
// Step 1: Create deterministic fingerprint (for uniqueness check)
pinKey = HMAC-SHA256(pin, PIN_PEPPER)

// Step 2: Hash for secure storage
pinHash = bcrypt(pin + PIN_PEPPER, 12 rounds)
```

#### **Uniqueness**
- `pinKey` has unique index in database
- Prevents duplicate PINs within a tenant
- Different tenants can have same PIN (isolated databases)

#### **Brute Force Protection**
- Max 5 failed attempts (configurable)
- 15-minute lockout after max attempts
- Lockout timer displayed to user

---

## 🔄 Login Flow

### **Old Flow (❌ Deprecated)**
```
1. Cashier opens POS app
2. Selects branch from dropdown
3. Selects POS terminal from dropdown
4. Enters PIN
5. Clicks Login
```

**Problems:**
- Cashier could select any branch/POS
- Security risk: unauthorized access
- Poor UX: unnecessary selections

### **New Flow (✅ Current)**
```
1. Cashier opens POS app
2. Enters 6-digit PIN
3. Clicks Login
4. System automatically:
   - Validates PIN
   - Determines assigned branch
   - Determines available POS terminals
   - Routes to correct location
```

**Benefits:**
- ✅ Secure: Cashier can only access assigned branch
- ✅ Simple: PIN-only login
- ✅ Fast: No manual selections
- ✅ Auditable: All access logged

---

## 📡 API Specification

### **POST /t/auth/login-pin**

#### **Request**
```http
POST /t/auth/login-pin
Headers:
  x-tenant-id: acme
  Content-Type: application/json

Body:
{
  "pin": "123456"
}
```

#### **Response - Single POS Assignment**
```json
{
  "status": 200,
  "message": "Login successful",
  "result": {
    "token": "eyJhbGc...",
    "user": {
      "_id": "65c...",
      "fullName": "John Doe",
      "email": "john@acme.com",
      "roles": ["cashier"],
      "isStaff": true,
      "position": "Cashier",
      "assignedBranchId": "65a...",
      "posIds": ["65b..."]
    },
    "branchId": "65a...",
    "posId": "65b...",
    "posName": "POS Terminal 1",
    "requiresPosSelection": false,
    "availableTerminals": [
      {
        "_id": "65b...",
        "name": "POS Terminal 1",
        "machineId": "POS-001",
        "status": "active"
      }
    ],
    "tillSessionId": null
  }
}
```

#### **Response - Multiple POS Options**
```json
{
  "status": 200,
  "message": "Login successful",
  "result": {
    "token": "eyJhbGc...",
    "user": { ... },
    "branchId": "65a...",
    "posId": null,
    "posName": null,
    "requiresPosSelection": true,
    "availableTerminals": [
      {
        "_id": "65b...",
        "name": "POS Terminal 1",
        "machineId": "POS-001",
        "status": "active"
      },
      {
        "_id": "65c...",
        "name": "POS Terminal 2",
        "machineId": "POS-002",
        "status": "active"
      }
    ],
    "tillSessionId": null
  }
}
```

#### **Error Responses**

**Invalid PIN**
```json
{
  "status": 401,
  "message": "Invalid credentials"
}
```

**Account Locked**
```json
{
  "status": 423,
  "message": "PIN is locked. Try again in 12 minute(s)"
}
```

**No Branch Assignment**
```json
{
  "status": 403,
  "message": "Cashier is not assigned to any branch. Please contact your manager."
}
```

---

## 🔧 Staff Management

### **Creating a Cashier**

```http
POST /t/staff
Headers:
  Authorization: Bearer <manager-token>
  x-tenant-id: acme

Body:
{
  "fullName": "Jane Smith",
  "email": "jane@acme.com",
  "password": "SecurePass123",
  "pin": "654321",
  "position": "Cashier",
  "assignedBranchId": "65a...",  // REQUIRED for cashiers
  "posIds": ["65b..."],           // Optional: restrict to specific POS
  "roles": ["cashier"]
}
```

### **POS Assignment Scenarios**

#### **Scenario 1: Single POS (Auto-Login)**
```javascript
{
  "assignedBranchId": "branch-123",
  "posIds": ["pos-001"]
}
// Result: Cashier auto-logs into POS-001
```

#### **Scenario 2: Multiple POS (Selection Required)**
```javascript
{
  "assignedBranchId": "branch-123",
  "posIds": ["pos-001", "pos-002", "pos-003"]
}
// Result: Cashier selects from 3 POS terminals
```

#### **Scenario 3: No POS Restrictions (Any POS)**
```javascript
{
  "assignedBranchId": "branch-123",
  "posIds": []
}
// Result: Cashier can use any active POS in branch
```

---

## 🔐 Security Features

### **1. PIN Uniqueness**
- Enforced at database level via unique index on `pinKey`
- Prevents duplicate PINs within tenant
- Validation error on duplicate: `"PIN already in use"`

### **2. Branch Isolation**
- Cashier can ONLY access their `assignedBranchId`
- Cannot login to other branches even if they know branch ID
- Enforced at service layer (not just frontend)

### **3. POS Restrictions**
- If `posIds` is set, cashier can only use those terminals
- If `posIds` is empty, cashier can use any POS in assigned branch
- Validated on every login and till session

### **4. Brute Force Protection**
```javascript
// Configuration
PIN_LOGIN_MAX_ATTEMPTS = 5      // Max failed attempts
PIN_LOGIN_LOCK_MINUTES = 15     // Lockout duration

// Behavior
- Failed attempt → increment counter
- 5th failed attempt → lock for 15 minutes
- Successful login → reset counter
```

### **5. Audit Trail**
All login attempts logged with:
- Timestamp
- User ID
- Success/Failure
- IP Address (if available)
- Branch/POS attempted

---

## 🚀 Migration Guide

### **For Existing Tenants**

#### **Step 1: Run Migration Script**
```bash
# Preview changes (dry run)
node scripts/migrations/migrate-cashier-assignments.js <tenant-slug> --dry-run

# Apply changes
node scripts/migrations/migrate-cashier-assignments.js <tenant-slug>

# Migrate all tenants
node scripts/migrations/migrate-cashier-assignments.js --all
```

#### **Step 2: Review Warnings**
The script will identify:
- ✅ **Auto-migrated**: Cashiers with single branch
- ⚠️ **Needs Review**: Cashiers with multiple branches
- ❌ **Needs Fix**: Cashiers with no branches

#### **Step 3: Manual Assignments**
For cashiers flagged with warnings:
```http
PATCH /t/staff/:id
{
  "assignedBranchId": "65a...",  // Choose primary branch
  "posIds": ["65b..."]            // Optional: restrict POS
}
```

#### **Step 4: Update PINs (Optional)**
If existing PINs are not 6 digits:
```http
PATCH /t/staff/:id/pin
{
  "pin": "123456"  // Must be exactly 6 digits
}
```

---

## 📱 Frontend Integration

### **Login Screen (New)**

```javascript
// Simple PIN-only login
const handleLogin = async (pin) => {
  try {
    const response = await fetch('/t/auth/login-pin', {
      method: 'POST',
      headers: {
        'x-tenant-id': tenantId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pin })
    });

    const data = await response.json();

    if (data.status === 200) {
      const { token, branchId, posId, requiresPosSelection, availableTerminals } = data.result;
      
      // Store token
      localStorage.setItem('token', token);
      
      if (requiresPosSelection) {
        // Show POS selection screen
        showPosSelection(availableTerminals);
      } else {
        // Auto-logged in, redirect to POS
        navigate('/pos');
      }
    }
  } catch (error) {
    // Handle error
  }
};
```

### **POS Selection Screen (If Needed)**

```javascript
const selectPOS = async (posId) => {
  // Update till session with selected POS
  const response = await fetch('/t/pos/till/open', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-tenant-id': tenantId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      posId: posId,
      openingAmount: 100.00
    })
  });
  
  // Proceed to POS interface
  navigate('/pos');
};
```

---

## 🧪 Testing Scenarios

### **Test Case 1: Valid PIN, Single POS**
```
Given: Cashier with PIN "123456", assigned to Branch A, POS 1
When: Cashier enters PIN "123456"
Then: 
  - Login successful
  - Auto-routed to Branch A, POS 1
  - requiresPosSelection = false
```

### **Test Case 2: Valid PIN, Multiple POS**
```
Given: Cashier with PIN "123456", assigned to Branch A, POS 1-3
When: Cashier enters PIN "123456"
Then:
  - Login successful
  - Routed to Branch A
  - requiresPosSelection = true
  - availableTerminals = [POS 1, POS 2, POS 3]
```

### **Test Case 3: Invalid PIN**
```
Given: Cashier with PIN "123456"
When: Cashier enters PIN "999999"
Then:
  - Login failed
  - Error: "Invalid credentials"
  - Failed attempt counter incremented
```

### **Test Case 4: No Branch Assignment**
```
Given: Staff member with PIN but no assignedBranchId
When: Staff enters PIN
Then:
  - Login failed
  - Error: "Cashier is not assigned to any branch"
```

### **Test Case 5: Account Locked**
```
Given: Cashier with 5 failed login attempts
When: Cashier enters correct PIN
Then:
  - Login blocked
  - Error: "PIN is locked. Try again in 15 minute(s)"
```

---

## 🔍 Troubleshooting

### **Issue: "PIN already in use"**
**Cause**: Another cashier in the same tenant has this PIN  
**Solution**: Choose a different 6-digit PIN

### **Issue: "Cashier is not assigned to any branch"**
**Cause**: `assignedBranchId` is null  
**Solution**: Manager must assign cashier to a branch

### **Issue: "POS terminal does not belong to assigned branch"**
**Cause**: Trying to assign POS from different branch  
**Solution**: Only assign POS terminals from the cashier's assigned branch

### **Issue: "PIN must be exactly 6 digits"**
**Cause**: PIN is not 6 digits (too short or too long)  
**Solution**: Use exactly 6 digits (e.g., "000123" not "123")

---

## 📊 Database Indexes

```javascript
// TenantUser collection
{ email: 1 }                    // unique
{ pinKey: 1 }                   // unique, sparse
{ assignedBranchId: 1, isStaff: 1 }  // performance
```

---

## 🎓 Best Practices

### **For Administrators**

1. **Assign Unique PINs**: Ensure each cashier has a unique 6-digit PIN
2. **Single Branch Assignment**: Each cashier should have exactly one `assignedBranchId`
3. **POS Restrictions**: Use `posIds` to restrict cashiers to specific terminals if needed
4. **Regular Audits**: Review login logs for suspicious activity
5. **Immediate Suspension**: Set `status: 'suspended'` for terminated cashiers

### **For Developers**

1. **Never Bypass Validation**: Always validate PIN format and uniqueness
2. **Enforce Branch Assignment**: Check `assignedBranchId` exists before allowing operations
3. **Log All Attempts**: Track both successful and failed login attempts
4. **Use Transactions**: When updating user assignments, use database transactions
5. **Test Edge Cases**: Test with no branch, multiple POS, locked accounts, etc.

---

## 📚 Related Documentation

- [POS Order Flow](./POS_ORDER_FLOW_COMPLETE.md)
- [Till Session Management](./API-CASHIER-SESSION.md)
- [Public Endpoints](./PUBLIC_ENDPOINTS_FOR_LOGIN.md)
- [Cashier Quick Reference](./CASHIER_QUICK_REFERENCE.md)

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2024-12-26 | Complete architecture redesign with assignedBranchId |
| 1.0.0 | 2024-01-15 | Initial PIN login implementation |

---

## 📞 Support

For questions or issues, contact the development team or refer to the main README.

