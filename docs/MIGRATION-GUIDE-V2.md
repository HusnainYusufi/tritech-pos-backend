# 🔄 Migration Guide: Cashier Authentication V2

## Overview

This guide helps you migrate from the old cashier authentication system to the new secure, streamlined architecture.

---

## 🎯 What's Changing?

### **Before (V1)**
- Cashiers manually select branch and POS terminal
- PIN can be 4-8 digits
- Frontend passes `branchId` and `posId` in login request
- Security risk: cashiers could access any branch/POS

### **After (V2)**
- Cashiers only enter PIN (6 digits)
- System automatically routes to assigned branch/POS
- PIN must be exactly 6 digits
- Secure: cashiers restricted to assigned branch only

---

## 📋 Pre-Migration Checklist

- [ ] Backup database
- [ ] Review all cashier accounts
- [ ] Identify cashiers with multiple branches
- [ ] Plan branch assignments for multi-branch cashiers
- [ ] Communicate changes to staff
- [ ] Update frontend application
- [ ] Test in staging environment

---

## 🚀 Migration Steps

### **Step 1: Database Schema Update**

The schema changes are automatic when you deploy the new code. The new fields are:
- `assignedBranchId` (ObjectId) - Primary branch assignment
- Enhanced `posIds` array - POS restrictions

**No manual database changes needed!**

---

### **Step 2: Run Migration Script**

#### **Option A: Single Tenant**

```bash
# Preview changes (recommended first)
node scripts/migrations/migrate-cashier-assignments.js <tenant-slug> --dry-run

# Review output, then apply
node scripts/migrations/migrate-cashier-assignments.js <tenant-slug>
```

#### **Option B: All Tenants**

```bash
# Preview all tenants
node scripts/migrations/migrate-cashier-assignments.js --all --dry-run

# Apply to all tenants
node scripts/migrations/migrate-cashier-assignments.js --all
```

---

### **Step 3: Review Migration Results**

The script will categorize cashiers:

#### ✅ **Auto-Migrated**
Cashiers with exactly 1 branch → automatically assigned

```
✅ MIGRATE: John Doe (john@acme.com)
   Branch: 65a1234567890abcdef12345
```

**Action Required:** None

#### ⚠️ **Needs Manual Assignment**
Cashiers with multiple branches

```
⚠️  WARNING: Jane Smith (jane@acme.com)
   Has 3 branches: 65a..., 65b..., 65c...
   ➡️  Manual intervention required: Choose primary branch
```

**Action Required:** Assign primary branch (see Step 4)

#### ❌ **Needs Fix**
Cashiers with no branches

```
❌ ERROR: Bob Wilson (bob@acme.com)
   No branches assigned!
   ➡️  Manual intervention required: Assign a branch
```

**Action Required:** Assign a branch (see Step 4)

---

### **Step 4: Manual Assignments**

For cashiers that need manual intervention:

#### **Assign Primary Branch**

```http
PATCH /t/staff/:staffId
Authorization: Bearer <admin-token>
x-tenant-id: acme
Content-Type: application/json

{
  "assignedBranchId": "65a1234567890abcdef12345"
}
```

#### **Assign Specific POS Terminals (Optional)**

```http
PATCH /t/staff/:staffId
Authorization: Bearer <admin-token>
x-tenant-id: acme
Content-Type: application/json

{
  "assignedBranchId": "65a1234567890abcdef12345",
  "posIds": ["65b...", "65c..."]  // Restrict to these POS only
}
```

#### **Allow Any POS in Branch**

```http
PATCH /t/staff/:staffId
Authorization: Bearer <admin-token>
x-tenant-id: acme
Content-Type: application/json

{
  "assignedBranchId": "65a1234567890abcdef12345",
  "posIds": []  // Can use any POS in branch
}
```

---

### **Step 5: Update PINs (If Needed)**

If existing PINs are not 6 digits, update them:

```http
PATCH /t/staff/:staffId/pin
Authorization: Bearer <admin-token>
x-tenant-id: acme
Content-Type: application/json

{
  "pin": "123456"  // Must be exactly 6 digits
}
```

**Note:** The system will reject non-6-digit PINs after migration.

---

### **Step 6: Update Frontend**

#### **Old Login Code (V1)**

```javascript
// ❌ OLD - Don't use
const loginWithPIN = async (tenantId, branchId, terminalId, pin) => {
  const response = await fetch(`${API_URL}/t/auth/login-pin`, {
    method: 'POST',
    headers: {
      'x-tenant-id': tenantId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      pin,
      branchId,      // ❌ No longer needed
      posId: terminalId  // ❌ No longer needed
    })
  });
  return response.json();
};
```

#### **New Login Code (V2)**

```javascript
// ✅ NEW - Use this
const loginWithPIN = async (tenantId, pin) => {
  const response = await fetch(`${API_URL}/t/auth/login-pin`, {
    method: 'POST',
    headers: {
      'x-tenant-id': tenantId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      pin  // ✅ Only PIN needed
    })
  });
  
  const data = await response.json();
  
  if (data.status === 200) {
    const { token, branchId, posId, requiresPosSelection, availableTerminals } = data.result;
    
    if (requiresPosSelection) {
      // Show POS selection screen
      return { needsPosSelection: true, terminals: availableTerminals };
    } else {
      // Auto-logged in
      return { needsPosSelection: false, token, branchId, posId };
    }
  }
  
  throw new Error(data.message);
};
```

#### **Handle POS Selection (If Needed)**

```javascript
const selectPOS = async (token, posId) => {
  // Open till session with selected POS
  const response = await fetch(`${API_URL}/t/pos/till/open`, {
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
  
  return response.json();
};
```

---

### **Step 7: Remove Old UI Components**

#### **Remove These Components:**
- ❌ Branch selection dropdown on login screen
- ❌ POS terminal selection dropdown on login screen
- ❌ Branch/POS fetching logic before login

#### **Keep/Add These Components:**
- ✅ PIN input field (6 digits only)
- ✅ POS selection screen (shown only if `requiresPosSelection: true`)
- ✅ Error handling for locked accounts

---

## 🧪 Testing Checklist

### **Functional Tests**

- [ ] Cashier with single POS can login with PIN only
- [ ] Cashier with multiple POS sees selection screen
- [ ] Cashier with no POS restrictions sees all branch POS
- [ ] Invalid PIN shows error message
- [ ] 5 failed attempts locks account
- [ ] Locked account shows time remaining
- [ ] Successful login after lockout resets counter

### **Security Tests**

- [ ] Cashier cannot access other branches
- [ ] Duplicate PINs are rejected
- [ ] Non-6-digit PINs are rejected
- [ ] Suspended accounts cannot login
- [ ] Unassigned cashiers cannot login

### **Edge Cases**

- [ ] Cashier with no `assignedBranchId` gets clear error
- [ ] Cashier with invalid `posIds` gets error
- [ ] POS terminal from different branch is rejected
- [ ] Inactive POS terminals are not shown

---

## 🔄 Rollback Plan

If you need to rollback:

### **Step 1: Revert Code**
```bash
git revert <commit-hash>
git push
```

### **Step 2: Database Cleanup (Optional)**
The new fields (`assignedBranchId`, updated `posIds`) won't break the old code. You can leave them in place or remove:

```javascript
// MongoDB shell
db.tenantusers.updateMany(
  { isStaff: true },
  { $unset: { assignedBranchId: "" } }
);
```

### **Step 3: Restore Frontend**
Deploy previous frontend version that includes branch/POS selection.

---

## 📊 Migration Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| **Preparation** | 1-2 days | Review accounts, plan assignments |
| **Migration** | 1-2 hours | Run scripts, manual assignments |
| **Testing** | 1-2 days | Verify all scenarios |
| **Deployment** | 1 hour | Deploy frontend + backend |
| **Monitoring** | 1 week | Watch for issues |

---

## 🆘 Troubleshooting

### **Issue: Migration script fails**

**Error:** `Cannot read property 'branchIds' of undefined`

**Solution:** Ensure database connection is working:
```bash
node scripts/test-tenant-connection.js <tenant-slug>
```

---

### **Issue: Cashier can't login after migration**

**Error:** `Cashier is not assigned to any branch`

**Solution:** Check if `assignedBranchId` is set:
```javascript
// MongoDB shell
db.tenantusers.findOne({ email: "cashier@example.com" })
```

If null, assign a branch:
```http
PATCH /t/staff/:id
{ "assignedBranchId": "65a..." }
```

---

### **Issue: "PIN already in use"**

**Cause:** Two cashiers have the same PIN

**Solution:** Change one cashier's PIN:
```http
PATCH /t/staff/:id/pin
{ "pin": "654321" }
```

---

### **Issue: Frontend shows branch/POS dropdowns**

**Cause:** Frontend not updated

**Solution:** Deploy new frontend version that removes dropdowns

---

## 📞 Support

For migration assistance:
1. Check logs: `logs/error-detailed.log`
2. Review migration output
3. Contact development team
4. Refer to [Architecture Documentation](./CASHIER-AUTHENTICATION-ARCHITECTURE.md)

---

## ✅ Post-Migration Checklist

- [ ] All cashiers have `assignedBranchId`
- [ ] All PINs are 6 digits
- [ ] No duplicate PINs exist
- [ ] Frontend updated and deployed
- [ ] All cashiers can login successfully
- [ ] Security tests passing
- [ ] Documentation updated
- [ ] Team trained on new system

---

## 🎉 Success Criteria

Migration is successful when:
1. ✅ All cashiers can login with PIN only
2. ✅ No manual branch/POS selection required
3. ✅ Security restrictions working (branch isolation)
4. ✅ No duplicate PINs in system
5. ✅ All PINs are exactly 6 digits
6. ✅ Frontend simplified (no dropdowns)
7. ✅ Zero security incidents

---

**Last Updated:** December 26, 2024  
**Version:** 2.0.0

