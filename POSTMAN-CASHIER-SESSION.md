# 📮 Postman: Cashier Session Endpoint

## 🎯 Quick Setup

### 1. Import Collection
**File:** `docs/postman/cashier-session.postman_collection.json`

1. Open Postman
2. Click **Import**
3. Select the file above
4. Collection "Cashier Session API" will be added

---

## ⚙️ Configure Variables

Before testing, set these collection variables:

| Variable | Example Value | Description |
|----------|--------------|-------------|
| `base_url` | `http://localhost:3003` | Your API base URL |
| `tenant_id` | `extraction-testt` | Your tenant slug |
| `branch_id` | `65a1234567890abcdef12345` | Branch ID |
| `pos_id` | `65b1234567890abcdef12345` | POS Terminal ID |
| `token` | *(auto-filled)* | JWT token (auto-saved) |

**How to set:**
1. Click on collection "Cashier Session API"
2. Go to **Variables** tab
3. Update `base_url`, `tenant_id`, `branch_id`, `pos_id`
4. Click **Save**

---

## 🚀 The Main Call

### **GET Cashier Session**

```
GET {{base_url}}/t/pos/till/session
```

#### Headers:
```
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
```

#### No Body Required! ✨

---

## 📋 Step-by-Step Test Flow

### Step 1: Login with PIN
```
POST /t/auth/login-pin
```
- Saves token automatically
- Use this token for all subsequent calls

### Step 2: Get Session (No Till)
```
GET /t/pos/till/session
```
**Expected:** `hasTillSession: false`

### Step 3: Open Till
```
POST /t/pos/till/open
```
- Updates token with `tillSessionId`
- Token auto-saved

### Step 4: Get Session (With Till)
```
GET /t/pos/till/session
```
**Expected:** Full session data with stats

### Step 5: Create Orders
```
POST /t/pos/orders
```
- Create some orders to update stats

### Step 6: Get Session (After Orders)
```
GET /t/pos/till/session
```
**Expected:** Updated stats with order counts and balance

---

## 📸 Postman Screenshots Guide

### Setting Up the Request

**Method:** `GET`

**URL:** 
```
http://localhost:3003/t/pos/till/session
```

**Headers Tab:**
```
Key: Authorization
Value: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Key: x-tenant-id  
Value: extraction-testt
```

**Body Tab:**
```
(empty - no body needed)
```

---

## ✅ Expected Response

### Status: `200 OK`

### Body:
```json
{
  "status": 200,
  "message": "OK",
  "result": {
    "user": {
      "_id": "65c1234567890abcdef12345",
      "fullName": "John Doe",
      "email": "john@example.com",
      "roles": ["cashier"],
      "isStaff": true,
      "position": "Cashier",
      "branchIds": ["65a1234567890abcdef12345"],
      "status": "active"
    },
    "session": {
      "branchId": "65a1234567890abcdef12345",
      "posId": "65b1234567890abcdef12345",
      "posName": "POS Terminal 1",
      "tillSessionId": "65d1234567890abcdef12345",
      "hasTillSession": true
    },
    "tillSession": {
      "_id": "65d1234567890abcdef12345",
      "status": "open",
      "openingAmount": 100,
      "openedAt": "2024-01-15T10:00:00.000Z",
      "cashCounts": null,
      "notes": "Testing cashier session endpoint"
    },
    "terminal": {
      "_id": "65b1234567890abcdef12345",
      "name": "POS Terminal 1",
      "code": "POS-001",
      "status": "active"
    },
    "branch": {
      "_id": "65a1234567890abcdef12345",
      "name": "Main Branch",
      "code": "BR-001",
      "address": "123 Main St"
    },
    "stats": {
      "totalOrders": 15,
      "totalSales": 1250.50,
      "totalCash": 850.00,
      "totalCard": 300.50,
      "totalMobile": 100.00,
      "currentBalance": 950.00,
      "expectedBalance": 950.00,
      "openingAmount": 100.00,
      "sessionDuration": 180
    }
  }
}
```

---

## 🎨 Postman Tests (Auto-Validation)

Add this to the **Tests** tab to auto-validate:

```javascript
// Test 1: Status is 200
pm.test("Status is 200", function () {
    pm.response.to.have.status(200);
});

// Test 2: Response has result
pm.test("Response has result", function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('result');
});

// Test 3: User data exists
pm.test("User data exists", function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData.result).to.have.property('user');
    pm.expect(jsonData.result.user).to.have.property('fullName');
    pm.expect(jsonData.result.user).to.have.property('email');
});

// Test 4: Session data exists
pm.test("Session data exists", function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData.result).to.have.property('session');
    pm.expect(jsonData.result.session).to.have.property('hasTillSession');
});

// Test 5: No sensitive data exposed
pm.test("No sensitive data exposed", function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData.result.user).to.not.have.property('passwordHash');
    pm.expect(jsonData.result.user).to.not.have.property('pinHash');
    pm.expect(jsonData.result.user).to.not.have.property('resetToken');
});

// Test 6: If till is open, stats should exist
pm.test("Stats exist when till is open", function () {
    const jsonData = pm.response.json();
    if (jsonData.result.session.hasTillSession) {
        pm.expect(jsonData.result).to.have.property('stats');
        pm.expect(jsonData.result.stats).to.have.property('currentBalance');
        pm.expect(jsonData.result.stats).to.have.property('totalOrders');
    }
});

console.log("✅ All tests passed!");
```

---

## 🔧 Troubleshooting

### ❌ Error: 401 Unauthorized
**Problem:** Token is missing or expired

**Fix:**
1. Run "1. Login with PIN" first
2. Token will be auto-saved
3. Try again

---

### ❌ Error: 403 Forbidden
**Problem:** User doesn't have permissions

**Fix:**
1. Check user has `pos.till.manage` or `pos.orders.read` permission
2. Verify user status is `active`

---

### ❌ Error: 404 Not Found
**Problem:** Endpoint not found

**Fix:**
1. Check base URL is correct
2. Verify server is running
3. Check route: `/t/pos/till/session`

---

### ❌ Stats are null
**Problem:** No till session open

**Fix:**
1. Run "3. Open Till Session" first
2. Use the NEW token returned
3. Try again

---

## 💡 Pro Tips

### 1. Use Environment Variables
Create a Postman environment for different servers:
- **Local**: `http://localhost:3003`
- **Staging**: `https://staging-api.yourapp.com`
- **Production**: `https://api.yourapp.com`

### 2. Save Example Responses
Click **Save Response** → **Save as Example**
- Helps document expected responses
- Useful for team collaboration

### 3. Create Tests
Add tests to validate responses automatically:
- Status codes
- Response structure
- Data types
- Business logic

### 4. Use Pre-request Scripts
Auto-refresh token if expired:
```javascript
// Check if token is expired
const token = pm.collectionVariables.get('token');
if (!token || isTokenExpired(token)) {
    // Auto-login
    pm.sendRequest({
        url: pm.variables.get('base_url') + '/t/auth/login-pin',
        method: 'POST',
        header: {
            'Content-Type': 'application/json',
            'x-tenant-id': pm.variables.get('tenant_id')
        },
        body: {
            mode: 'raw',
            raw: JSON.stringify({
                pin: '1234',
                branchId: pm.variables.get('branch_id'),
                posId: pm.variables.get('pos_id')
            })
        }
    }, function (err, res) {
        if (!err) {
            const newToken = res.json().result.token;
            pm.collectionVariables.set('token', newToken);
        }
    });
}
```

---

## 📊 Response Time Benchmarks

| Scenario | Expected Time |
|----------|--------------|
| No till session | 30-50ms |
| With till session (no orders) | 50-80ms |
| With till session (with orders) | 80-120ms |

If response time is higher:
- Check database indexes
- Review server logs
- Check network latency

---

## 🎯 Quick Copy-Paste

### cURL Version
```bash
curl -X GET "http://localhost:3003/t/pos/till/session" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "x-tenant-id: extraction-testt"
```

### JavaScript Fetch
```javascript
const response = await fetch('http://localhost:3003/t/pos/till/session', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN_HERE',
    'x-tenant-id': 'extraction-testt'
  }
});
const data = await response.json();
console.log(data.result);
```

### Axios
```javascript
const { data } = await axios.get('http://localhost:3003/t/pos/till/session', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN_HERE',
    'x-tenant-id': 'extraction-testt'
  }
});
console.log(data.result);
```

---

## ✅ Success Checklist

- [ ] Postman collection imported
- [ ] Variables configured (base_url, tenant_id, branch_id, pos_id)
- [ ] Login successful (token saved)
- [ ] GET session works without till
- [ ] Till opened successfully
- [ ] GET session works with till
- [ ] Stats show correct data
- [ ] All tests pass
- [ ] Response time < 150ms

---

**Ready to test!** 🚀

Import the collection and start with "1. Login with PIN"!
