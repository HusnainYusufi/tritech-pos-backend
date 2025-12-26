# 👨‍💻 Developer Quick Reference - Cashier Auth V2

## 🚀 Quick Start

### **Creating a Cashier**
```javascript
POST /t/staff
{
  "fullName": "John Doe",
  "email": "john@acme.com",
  "password": "SecurePass123",
  "pin": "123456",                    // ✅ Exactly 6 digits
  "assignedBranchId": "65a...",       // ✅ Required
  "posIds": ["65b..."],               // ✅ Optional (empty = any POS)
  "position": "Cashier",
  "roles": ["cashier"]
}
```

### **Cashier Login**
```javascript
POST /t/auth/login-pin
{
  "pin": "123456"  // ✅ Only PIN needed
}
```

### **Updating Cashier Assignment**
```javascript
PATCH /t/staff/:id
{
  "assignedBranchId": "65a...",
  "posIds": ["65b...", "65c..."]
}
```

### **Changing PIN**
```javascript
PATCH /t/staff/:id/pin
{
  "pin": "654321"  // ✅ Must be 6 digits
}
```

---

## 📋 Data Model

### **TenantUser Schema (Key Fields)**
```javascript
{
  // Identity
  _id: ObjectId,
  email: String (unique),
  fullName: String,
  
  // Authentication
  pinHash: String,              // bcrypt(pin + pepper)
  pinKey: String (unique),      // HMAC-SHA256(pin, pepper)
  
  // Assignment (NEW)
  assignedBranchId: ObjectId,   // Primary branch
  posIds: [ObjectId],           // POS restrictions
  
  // Security
  pinLoginFailures: Number,
  pinLockedUntil: Date,
  status: 'active' | 'suspended'
}
```

---

## 🔐 Security Rules

### **PIN Requirements**
- ✅ Exactly 6 digits
- ✅ Unique within tenant
- ✅ Stored as bcrypt hash
- ❌ No letters or special characters

### **Branch Assignment**
- ✅ Required for all cashiers
- ✅ Must be a valid branch ID
- ✅ Enforced at service layer
- ❌ Cannot be null for staff with PIN

### **POS Restrictions**
- ✅ Optional (empty array = any POS)
- ✅ Must belong to assigned branch
- ✅ Validated on login and till open
- ❌ Cannot include POS from other branches

---

## 🎯 Common Scenarios

### **Scenario 1: Single POS Cashier**
```javascript
// Setup
{
  assignedBranchId: "branch-123",
  posIds: ["pos-001"]
}

// Login Response
{
  branchId: "branch-123",
  posId: "pos-001",
  requiresPosSelection: false  // ✅ Auto-logged in
}
```

### **Scenario 2: Multi-POS Cashier**
```javascript
// Setup
{
  assignedBranchId: "branch-123",
  posIds: ["pos-001", "pos-002", "pos-003"]
}

// Login Response
{
  branchId: "branch-123",
  posId: null,
  requiresPosSelection: true,  // ⚠️ Needs selection
  availableTerminals: [...]
}
```

### **Scenario 3: Flexible Cashier**
```javascript
// Setup
{
  assignedBranchId: "branch-123",
  posIds: []  // Empty = any POS
}

// Login Response
{
  branchId: "branch-123",
  posId: null,
  requiresPosSelection: true,  // ⚠️ Needs selection
  availableTerminals: [...]    // All active POS in branch
}
```

---

## 🔧 Code Examples

### **Backend: Validate Cashier Assignment**
```javascript
// In StaffService.create()
if (assignedBranchId) {
  // Validate branch exists
  const branch = await BranchRepo.getById(conn, assignedBranchId);
  if (!branch) throw new AppError('Branch not found', 404);
  
  // Validate POS terminals belong to branch
  if (posIds && posIds.length > 0) {
    for (const posId of posIds) {
      const terminal = await PosTerminalRepo.findById(conn, posId);
      if (!terminal) throw new AppError('POS not found', 404);
      if (String(terminal.branchId) !== String(assignedBranchId)) {
        throw new AppError('POS does not belong to assigned branch', 400);
      }
    }
  }
}
```

### **Backend: Get Available Terminals**
```javascript
// In PosTerminalService
static async getAvailableForCashier(conn, branchId, posIds = []) {
  const filter = { branchId, status: 'active' };
  
  // If posIds specified, filter to only those
  if (posIds && posIds.length > 0) {
    filter._id = { $in: posIds };
  }
  
  return await PosTerminal.find(filter)
    .select('_id name machineId status')
    .sort({ name: 1 })
    .lean();
}
```

### **Frontend: Handle Login Response**
```javascript
const handleLogin = async (pin) => {
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
    const { 
      token, 
      branchId, 
      posId, 
      requiresPosSelection, 
      availableTerminals 
    } = data.result;
    
    // Store token
    localStorage.setItem('token', token);
    
    if (requiresPosSelection) {
      // Show POS selection screen
      showPosSelection(availableTerminals);
    } else {
      // Auto-logged in, go to POS
      navigate('/pos');
    }
  }
};
```

---

## ⚠️ Common Errors

### **Error: "PIN must be exactly 6 digits"**
```javascript
// ❌ Wrong
{ "pin": "1234" }      // Too short
{ "pin": "12345678" }  // Too long
{ "pin": "abc123" }    // Not numeric

// ✅ Correct
{ "pin": "123456" }
{ "pin": "000001" }
{ "pin": "999999" }
```

### **Error: "PIN already in use"**
```javascript
// Cause: Another cashier has this PIN
// Solution: Choose different PIN
PATCH /t/staff/:id/pin
{ "pin": "654321" }
```

### **Error: "Cashier is not assigned to any branch"**
```javascript
// Cause: assignedBranchId is null
// Solution: Assign a branch
PATCH /t/staff/:id
{ "assignedBranchId": "65a..." }
```

### **Error: "POS terminal does not belong to assigned branch"**
```javascript
// Cause: Trying to assign POS from different branch
// Solution: Only assign POS from cashier's branch

// ❌ Wrong
{
  assignedBranchId: "branch-A",
  posIds: ["pos-from-branch-B"]  // Different branch!
}

// ✅ Correct
{
  assignedBranchId: "branch-A",
  posIds: ["pos-from-branch-A"]
}
```

---

## 🧪 Testing

### **Unit Test: Login with Valid PIN**
```javascript
it('should login with valid 6-digit PIN', async () => {
  const result = await TenantAuthService.loginWithPin(conn, {
    pin: '123456'
  });
  
  expect(result.status).toBe(200);
  expect(result.result.token).toBeDefined();
  expect(result.result.branchId).toBeDefined();
});
```

### **Unit Test: Reject Invalid PIN**
```javascript
it('should reject non-6-digit PIN', async () => {
  await expect(
    TenantAuthService.loginWithPin(conn, { pin: '1234' })
  ).rejects.toThrow('PIN must be exactly 6 digits');
});
```

### **Integration Test: Full Login Flow**
```javascript
it('should complete full login with single POS', async () => {
  // Create cashier
  const cashier = await StaffService.create(conn, adminId, {
    fullName: 'Test Cashier',
    email: 'test@acme.com',
    pin: '123456',
    assignedBranchId: branchId,
    posIds: [posId]
  });
  
  // Login
  const result = await TenantAuthService.loginWithPin(conn, {
    pin: '123456'
  });
  
  expect(result.result.branchId).toBe(branchId);
  expect(result.result.posId).toBe(posId);
  expect(result.result.requiresPosSelection).toBe(false);
});
```

---

## 📊 Database Queries

### **Find Cashiers by Branch**
```javascript
db.tenantusers.find({
  isStaff: true,
  assignedBranchId: ObjectId("65a...")
})
```

### **Find Cashiers Without Assignment**
```javascript
db.tenantusers.find({
  isStaff: true,
  pinHash: { $ne: null },
  assignedBranchId: null
})
```

### **Check for Duplicate PINs**
```javascript
db.tenantusers.aggregate([
  { $match: { pinKey: { $ne: null } } },
  { $group: { _id: "$pinKey", count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
])
```

### **Update Cashier Assignment**
```javascript
db.tenantusers.updateOne(
  { _id: ObjectId("65c...") },
  { 
    $set: { 
      assignedBranchId: ObjectId("65a..."),
      posIds: [ObjectId("65b...")]
    } 
  }
)
```

---

## 🔍 Debugging

### **Check Cashier Configuration**
```javascript
// MongoDB shell
db.tenantusers.findOne(
  { email: "john@acme.com" },
  { 
    email: 1, 
    assignedBranchId: 1, 
    posIds: 1, 
    pinKey: 1,
    status: 1 
  }
)
```

### **Check Available Terminals**
```javascript
// MongoDB shell
db.posterminals.find({
  branchId: ObjectId("65a..."),
  status: "active"
})
```

### **Check Login Failures**
```javascript
// MongoDB shell
db.tenantusers.find({
  pinLoginFailures: { $gt: 0 }
}, {
  email: 1,
  pinLoginFailures: 1,
  pinLockedUntil: 1
})
```

---

## 🚨 Troubleshooting Checklist

- [ ] PIN is exactly 6 digits
- [ ] PIN is unique in tenant
- [ ] assignedBranchId is set
- [ ] assignedBranchId is valid branch
- [ ] posIds belong to assigned branch
- [ ] Account status is 'active'
- [ ] Account is not locked (pinLockedUntil)
- [ ] POS terminals are active

---

## 📚 Related Files

| File | Purpose |
|------|---------|
| `features/tenant-auth/services/TenantAuthService.js` | Login logic |
| `features/staff/services/StaffService.js` | Staff management |
| `features/pos/services/PosTerminalService.js` | POS terminal logic |
| `features/tenant-auth/model/TenantUser.schema.js` | User schema |
| `features/tenant-auth/validation/tenantAuth.validation.js` | Login validation |
| `features/staff/validation/staff.validation.js` | Staff validation |

---

## 🔗 Quick Links

- [Architecture Documentation](./CASHIER-AUTHENTICATION-ARCHITECTURE.md)
- [Migration Guide](./MIGRATION-GUIDE-V2.md)
- [Flow Diagrams](./CASHIER-LOGIN-FLOW-DIAGRAM.md)
- [Solution Analysis](../SOLUTION-ARCHITECT-CASHIER-SECURITY.md)

---

## 💡 Pro Tips

1. **Always validate branch assignment** before allowing cashier operations
2. **Use indexed queries** for fast PIN lookups
3. **Log all login attempts** for security auditing
4. **Test edge cases** (no branch, multiple POS, locked accounts)
5. **Use transactions** when updating critical user data

---

*Last Updated: December 26, 2024*

