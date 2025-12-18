# 🔓 Public Endpoints for Cashier Login Flow

## Overview
These endpoints are **publicly accessible** (no authentication required) to support the cashier login screen workflow.

---

## 📋 Login Screen Flow

### **User Experience:**
1. Cashier opens POS application
2. **Selects Branch** from dropdown (fetched from public API)
3. **Selects Terminal** from dropdown (fetched from public API)
4. Enters **PIN**
5. Clicks **Login**
6. System authenticates and opens till session

### **Why Public?**
- Cashiers need to see branches and terminals **BEFORE** logging in
- Cannot fetch authenticated data without credentials
- This is a **Catch-22** that requires public endpoints

---

## 🔓 Public Endpoints

### 1. Get Branches List
```http
GET /t/branches
Headers:
  x-tenant-id: <tenant-slug>
  Content-Type: application/json

Query Parameters:
  status: active (optional) - Filter by branch status
  page: 1 (optional) - Page number
  limit: 100 (optional) - Items per page
```

**Response:**
```json
{
  "status": 200,
  "message": "OK",
  "items": [
    {
      "_id": "6900fbcf933c89883c6d21a3",
      "name": "Main Branch",
      "code": "main",
      "status": "active",
      "address": {
        "city": "Riyadh",
        "country": "Saudi Arabia"
      },
      "timezone": "Asia/Riyadh",
      "currency": "SAR"
    }
  ],
  "count": 1,
  "page": 1,
  "limit": 100
}
```

**Example:**
```bash
curl -X GET "http://localhost:3003/t/branches?status=active" \
  -H "x-tenant-id: extraction-testt"
```

---

### 2. Get Terminals List
```http
GET /t/pos/terminals
Headers:
  x-tenant-id: <tenant-slug>
  Content-Type: application/json

Query Parameters:
  branchId: <branch-id> (required) - Filter terminals by branch
  status: active (optional) - Filter by terminal status
```

**Response:**
```json
{
  "status": 200,
  "message": "OK",
  "result": [
    {
      "_id": "6900fbcf933c89883c6d21a4",
      "name": "Counter 1",
      "code": "counter-1",
      "branchId": "6900fbcf933c89883c6d21a3",
      "status": "active",
      "deviceInfo": {
        "type": "tablet",
        "os": "android"
      }
    },
    {
      "_id": "6900fbcf933c89883c6d21a5",
      "name": "Counter 2",
      "code": "counter-2",
      "branchId": "6900fbcf933c89883c6d21a3",
      "status": "active"
    }
  ]
}
```

**Example:**
```bash
curl -X GET "http://localhost:3003/t/pos/terminals?branchId=6900fbcf933c89883c6d21a3" \
  -H "x-tenant-id: extraction-testt"
```

---

## 🔒 Security Considerations

### **What's Protected:**
✅ These endpoints only return **basic information** (name, code, status)  
✅ No sensitive data exposed (no user info, no financial data)  
✅ Still requires valid `x-tenant-id` header  
✅ Tenant must exist in database  
✅ Rate limiting still applies  

### **What's NOT Exposed:**
❌ User credentials  
❌ Till balances  
❌ Order history  
❌ Financial reports  
❌ Staff information  
❌ Inventory data  

### **Why This is Safe:**
1. **Branch and terminal names are not sensitive** - They're displayed on physical locations
2. **Tenant isolation** - Only shows data for the specified tenant
3. **Read-only** - Cannot create, update, or delete
4. **Limited data** - Only returns what's needed for login dropdown
5. **Standard practice** - Many POS systems expose branch/terminal lists publicly

---

## 🎯 Frontend Implementation

### **React/Vue Example:**
```javascript
// 1. Fetch branches when login screen loads
const fetchBranches = async (tenantId) => {
  const response = await fetch(`${API_URL}/t/branches?status=active`, {
    headers: {
      'x-tenant-id': tenantId,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
};

// 2. Fetch terminals when branch is selected
const fetchTerminals = async (tenantId, branchId) => {
  const response = await fetch(
    `${API_URL}/t/pos/terminals?branchId=${branchId}&status=active`,
    {
      headers: {
        'x-tenant-id': tenantId,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.json();
};

// 3. Login with PIN
const loginWithPIN = async (tenantId, branchId, terminalId, pin) => {
  const response = await fetch(`${API_URL}/t/auth/login-pin`, {
    method: 'POST',
    headers: {
      'x-tenant-id': tenantId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      pin,
      branchId,
      posId: terminalId
    })
  });
  return response.json();
};
```

### **Complete Login Flow:**
```javascript
const CashierLogin = () => {
  const [branches, setBranches] = useState([]);
  const [terminals, setTerminals] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [selectedTerminal, setSelectedTerminal] = useState(null);
  const [pin, setPin] = useState('');

  // Load branches on mount
  useEffect(() => {
    fetchBranches(tenantId).then(data => {
      setBranches(data.items || []);
    });
  }, []);

  // Load terminals when branch changes
  useEffect(() => {
    if (selectedBranch) {
      fetchTerminals(tenantId, selectedBranch).then(data => {
        setTerminals(data.result || []);
      });
    }
  }, [selectedBranch]);

  const handleLogin = async () => {
    const result = await loginWithPIN(
      tenantId,
      selectedBranch,
      selectedTerminal,
      pin
    );
    
    if (result.status === 200) {
      // Store token and redirect to POS
      localStorage.setItem('token', result.result.token);
      navigate('/pos');
    }
  };

  return (
    <div>
      <select onChange={e => setSelectedBranch(e.target.value)}>
        <option>Select Branch</option>
        {branches.map(b => (
          <option key={b._id} value={b._id}>{b.name}</option>
        ))}
      </select>

      <select onChange={e => setSelectedTerminal(e.target.value)}>
        <option>Select Terminal</option>
        {terminals.map(t => (
          <option key={t._id} value={t._id}>{t.name}</option>
        ))}
      </select>

      <input
        type="password"
        placeholder="Enter PIN"
        value={pin}
        onChange={e => setPin(e.target.value)}
      />

      <button onClick={handleLogin}>Login</button>
    </div>
  );
};
```

---

## 📊 API Comparison

### **Before (Broken):**
```
1. User opens login screen
2. Try to fetch branches → ❌ 401 Unauthorized
3. Try to fetch terminals → ❌ 401 Unauthorized
4. User cannot see dropdowns
5. Cannot login ❌
```

### **After (Working):**
```
1. User opens login screen
2. Fetch branches → ✅ 200 OK (public endpoint)
3. Select branch from dropdown
4. Fetch terminals → ✅ 200 OK (public endpoint)
5. Select terminal from dropdown
6. Enter PIN and login → ✅ 200 OK
```

---

## 🧪 Testing

### **Test 1: Fetch Branches (No Auth)**
```bash
curl -X GET "http://localhost:3003/t/branches" \
  -H "x-tenant-id: extraction-testt"
```
**Expected:** ✅ 200 OK with branches list

### **Test 2: Fetch Terminals (No Auth)**
```bash
curl -X GET "http://localhost:3003/t/pos/terminals?branchId=6900fbcf933c89883c6d21a3" \
  -H "x-tenant-id: extraction-testt"
```
**Expected:** ✅ 200 OK with terminals list

### **Test 3: Complete Login Flow**
```bash
# 1. Get branches
BRANCHES=$(curl -s -X GET "http://localhost:3003/t/branches" \
  -H "x-tenant-id: extraction-testt")

# 2. Extract first branch ID
BRANCH_ID=$(echo $BRANCHES | jq -r '.items[0]._id')

# 3. Get terminals for that branch
TERMINALS=$(curl -s -X GET "http://localhost:3003/t/pos/terminals?branchId=$BRANCH_ID" \
  -H "x-tenant-id: extraction-testt")

# 4. Extract first terminal ID
TERMINAL_ID=$(echo $TERMINALS | jq -r '.result[0]._id')

# 5. Login with PIN
curl -X POST "http://localhost:3003/t/auth/login-pin" \
  -H "x-tenant-id: extraction-testt" \
  -H "Content-Type: application/json" \
  -d "{
    \"pin\": \"1234\",
    \"branchId\": \"$BRANCH_ID\",
    \"posId\": \"$TERMINAL_ID\"
  }"
```
**Expected:** ✅ Complete flow works without errors

---

## 📝 Configuration

### **Files Modified:**
1. `middlewares/Base.js` - Added branches endpoint to public routes
2. `features/branch/controller/BranchController.js` - Removed auth check from GET /
3. `features/pos/controller/PosTerminalController.js` - Already public (no changes)

### **Environment Variables:**
No additional environment variables required.

---

## 🚀 Deployment

### **No Breaking Changes:**
✅ Existing authenticated endpoints still work  
✅ Backward compatible  
✅ No database migrations needed  
✅ No configuration changes needed  

### **Deploy Steps:**
```bash
git pull origin main
pm2 restart tritech-pos-backend
```

---

## 📞 Support

### **Common Issues:**

**Q: Getting 404 on /t/branches?**  
A: Ensure you're using the correct base URL and tenant header

**Q: Terminals list is empty?**  
A: Check that terminals exist for the selected branch in the database

**Q: Still getting 401 Unauthorized?**  
A: Clear browser cache and ensure using latest code

---

**Version:** 1.0.0  
**Last Updated:** December 18, 2025  
**Status:** ✅ Production-Ready

