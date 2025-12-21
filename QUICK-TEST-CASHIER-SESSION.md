# 🚀 Quick Test: Cashier Session Endpoint

## One-Line Summary
**Get all cashier data (user, till, balance, stats) in one API call using just the JWT token.**

---

## 🎯 The Endpoint

```
GET /t/pos/till/session
```

---

## 📋 Quick Test Steps

### 1️⃣ Login as Cashier
```bash
curl -X POST "http://localhost:3003/t/auth/login-pin" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: extraction-testt" \
  -d '{
    "pin": "1234",
    "branchId": "{{your_branch_id}}",
    "posId": "{{your_pos_id}}"
  }'
```

**Save the token from response!**

---

### 2️⃣ Test WITHOUT Till Session
```bash
curl -X GET "http://localhost:3003/t/pos/till/session" \
  -H "Authorization: Bearer {{TOKEN}}" \
  -H "x-tenant-id: extraction-testt"
```

**Expected:**
```json
{
  "status": 200,
  "result": {
    "user": { ... },
    "session": {
      "hasTillSession": false
    },
    "tillSession": null,
    "stats": null
  }
}
```

---

### 3️⃣ Open Till
```bash
curl -X POST "http://localhost:3003/t/pos/till/open" \
  -H "Authorization: Bearer {{TOKEN}}" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: extraction-testt" \
  -d '{
    "branchId": "{{your_branch_id}}",
    "posId": "{{your_pos_id}}",
    "openingAmount": 100.00,
    "notes": "Testing session endpoint"
  }'
```

**Save the NEW token from response!**

---

### 4️⃣ Test WITH Till Session
```bash
curl -X GET "http://localhost:3003/t/pos/till/session" \
  -H "Authorization: Bearer {{NEW_TOKEN}}" \
  -H "x-tenant-id: extraction-testt"
```

**Expected:**
```json
{
  "status": 200,
  "result": {
    "user": {
      "fullName": "John Doe",
      "email": "john@example.com",
      "roles": ["cashier"]
    },
    "session": {
      "hasTillSession": true,
      "tillSessionId": "..."
    },
    "tillSession": {
      "status": "open",
      "openingAmount": 100.00,
      "openedAt": "2024-01-15T10:00:00Z"
    },
    "terminal": {
      "name": "POS Terminal 1",
      "code": "POS-001"
    },
    "branch": {
      "name": "Main Branch"
    },
    "stats": {
      "totalOrders": 0,
      "totalSales": 0,
      "currentBalance": 100.00,
      "sessionDuration": 2
    }
  }
}
```

---

### 5️⃣ Create Some Orders
```bash
curl -X POST "http://localhost:3003/t/pos/orders" \
  -H "Authorization: Bearer {{NEW_TOKEN}}" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: extraction-testt" \
  -d '{
    "items": [
      {
        "menuItemId": "{{menu_item_id}}",
        "quantity": 2
      }
    ],
    "branchId": "{{your_branch_id}}",
    "paymentMethod": "cash",
    "amountPaid": 50.00
  }'
```

---

### 6️⃣ Check Updated Stats
```bash
curl -X GET "http://localhost:3003/t/pos/till/session" \
  -H "Authorization: Bearer {{NEW_TOKEN}}" \
  -H "x-tenant-id: extraction-testt"
```

**Expected:**
```json
{
  "stats": {
    "totalOrders": 1,
    "totalSales": 50.00,
    "totalCash": 50.00,
    "currentBalance": 150.00,
    "sessionDuration": 5
  }
}
```

---

## ✅ What to Verify

- [ ] User details are returned (no password/PIN)
- [ ] `hasTillSession` is `false` before opening till
- [ ] `hasTillSession` is `true` after opening till
- [ ] Till session details are correct
- [ ] Terminal and branch info are populated
- [ ] Stats are `null` when no till session
- [ ] Stats show `0` orders when till just opened
- [ ] Stats update after creating orders
- [ ] Current balance = opening amount + cash received
- [ ] Session duration increases over time

---

## 🎯 Key Points to Check

### User Data
```json
{
  "user": {
    "_id": "...",
    "fullName": "...",
    "email": "...",
    "roles": [...],
    "isStaff": true,
    "position": "...",
    "status": "active"
  }
}
```
✅ No `passwordHash`, `pinHash`, or `resetToken`

### Session Flags
```json
{
  "session": {
    "hasTillSession": true,
    "tillSessionId": "..."
  }
}
```
✅ Easy to check if till is open

### Statistics
```json
{
  "stats": {
    "totalOrders": 5,
    "totalSales": 250.00,
    "totalCash": 150.00,
    "totalCard": 100.00,
    "currentBalance": 250.00,
    "sessionDuration": 120
  }
}
```
✅ Real-time calculations

---

## 🐛 Common Issues

### Issue: 401 Unauthorized
**Cause:** Token expired or invalid  
**Fix:** Login again and get new token

### Issue: 403 Forbidden
**Cause:** User doesn't have permissions  
**Fix:** Check user has `pos.till.manage` or `pos.orders.read`

### Issue: Stats are null
**Cause:** No till session open  
**Fix:** Open till first with `/t/pos/till/open`

### Issue: Stats show 0 orders
**Cause:** No orders created yet  
**Fix:** Create orders with `/t/pos/orders`

---

## 📱 Frontend Integration

### React Example
```javascript
import { useEffect, useState } from 'react';

function CashierDashboard() {
  const [session, setSession] = useState(null);
  
  useEffect(() => {
    async function loadSession() {
      const response = await fetch('/t/pos/till/session', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-tenant-id': tenant
        }
      });
      const { result } = await response.json();
      setSession(result);
    }
    
    loadSession();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadSession, 30000);
    return () => clearInterval(interval);
  }, []);
  
  if (!session) return <div>Loading...</div>;
  
  return (
    <div>
      <h1>Welcome, {session.user.fullName}</h1>
      
      {!session.session.hasTillSession ? (
        <button onClick={openTill}>Open Till</button>
      ) : (
        <div>
          <p>Till Balance: ${session.stats.currentBalance}</p>
          <p>Orders Today: {session.stats.totalOrders}</p>
          <p>Total Sales: ${session.stats.totalSales}</p>
        </div>
      )}
    </div>
  );
}
```

---

## 🎉 Success Criteria

✅ Endpoint responds with 200 OK  
✅ User data is complete and secure  
✅ Till session status is accurate  
✅ Statistics calculate correctly  
✅ Balance updates with orders  
✅ Works with and without till session  
✅ Performance is fast (<100ms)  
✅ No errors in server logs

---

**Ready to Test?** Follow steps 1-6 above! 🚀
