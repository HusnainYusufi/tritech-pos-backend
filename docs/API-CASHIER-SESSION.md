# 📱 Cashier Session API

## Overview

Get complete cashier session data from JWT token in a single API call.

**Endpoint:** `GET /t/pos/till/session`

---

## 🎯 Purpose

This endpoint provides everything a cashier needs to know about their current session:
- User details (name, email, roles)
- Till session status
- Current till balance
- Session statistics (orders, sales, payments)
- Terminal and branch information

**Perfect for:**
- Dashboard displays
- Session status checks
- Till balance monitoring
- Real-time sales tracking

---

## 🔐 Authentication

**Required:** JWT token in Authorization header

**Permissions:** One of:
- `pos.till.manage`
- `pos.orders.read`

---

## 📥 Request

```bash
GET /t/pos/till/session
Headers:
  Authorization: Bearer <JWT_TOKEN>
  x-tenant-id: your-tenant-slug
```

**No body or query parameters needed** - everything comes from the JWT token!

---

## 📤 Response

### Success Response (200 OK)

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
      "openingAmount": 100.00,
      "openedAt": "2024-01-15T10:00:00.000Z",
      "cashCounts": {
        "100": 1,
        "50": 0,
        "20": 0,
        "10": 0,
        "5": 0,
        "1": 0
      },
      "notes": "Starting morning shift"
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

### Response When No Till Session

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
      "posId": null,
      "posName": null,
      "tillSessionId": null,
      "hasTillSession": false
    },
    "tillSession": null,
    "terminal": null,
    "branch": null,
    "stats": null
  }
}
```

---

## 📊 Response Fields

### `user`
- `_id`: User ID
- `fullName`: Full name of the cashier
- `email`: Email address
- `roles`: Array of role names
- `isStaff`: Whether user is staff member
- `position`: Job position/title
- `branchIds`: Array of branch IDs user has access to
- `status`: Account status (active/suspended)

### `session`
- `branchId`: Current branch ID from token
- `posId`: Current POS terminal ID from token
- `posName`: POS terminal name from token
- `tillSessionId`: Active till session ID (null if no session)
- `hasTillSession`: Boolean flag for quick check

### `tillSession`
- `_id`: Till session ID
- `status`: Session status (open/closed)
- `openingAmount`: Starting cash amount
- `openedAt`: Session start timestamp
- `cashCounts`: Cash denomination breakdown
- `notes`: Session notes

### `terminal`
- `_id`: Terminal ID
- `name`: Terminal name
- `code`: Terminal code
- `status`: Terminal status

### `branch`
- `_id`: Branch ID
- `name`: Branch name
- `code`: Branch code
- `address`: Branch address

### `stats` (only when till session is open)
- `totalOrders`: Number of orders in this session
- `totalSales`: Total sales amount (all payment methods)
- `totalCash`: Total cash payments
- `totalCard`: Total card payments
- `totalMobile`: Total mobile payments
- `currentBalance`: Current till balance (opening + cash received)
- `expectedBalance`: Expected balance (should match currentBalance)
- `openingAmount`: Starting cash amount
- `sessionDuration`: Session duration in minutes

---

## 🔍 Use Cases

### 1. Dashboard Display

```javascript
// Fetch session data on app load
const response = await fetch('/t/pos/till/session', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'x-tenant-id': 'my-tenant'
  }
});

const { result } = await response.json();

// Display on dashboard
console.log(`Welcome, ${result.user.fullName}`);
console.log(`Till Balance: ${result.stats?.currentBalance || 'N/A'}`);
console.log(`Orders Today: ${result.stats?.totalOrders || 0}`);
```

### 2. Check Till Status

```javascript
const { result } = await fetchSession();

if (!result.session.hasTillSession) {
  // Prompt to open till
  showOpenTillModal();
} else {
  // Continue to POS
  navigateToPOS();
}
```

### 3. Real-time Balance Monitoring

```javascript
// Poll every 30 seconds for updated stats
setInterval(async () => {
  const { result } = await fetchSession();
  updateBalanceDisplay(result.stats?.currentBalance);
  updateOrderCount(result.stats?.totalOrders);
}, 30000);
```

---

## ⚠️ Error Responses

### 401 Unauthorized
```json
{
  "status": 401,
  "error": {
    "message": "Unauthorized"
  }
}
```

### 403 Forbidden
```json
{
  "status": 403,
  "error": {
    "message": "Account is not active"
  }
}
```

### 404 Not Found
```json
{
  "status": 404,
  "error": {
    "message": "User not found"
  }
}
```

---

## 🚀 Performance

- **Response Time:** ~50-100ms
- **Database Queries:** 3-5 (depending on till session status)
- **Caching:** User and branch data can be cached client-side
- **Recommended Polling:** Every 30-60 seconds for live stats

---

## 💡 Best Practices

1. **Cache User Data**: User details rarely change, cache them
2. **Poll Stats Only**: Only refresh stats frequently, not user data
3. **Handle No Session**: Always check `hasTillSession` before accessing stats
4. **Error Handling**: Handle 401/403 by redirecting to login
5. **Loading States**: Show loading indicator while fetching

---

## 🔗 Related Endpoints

- `POST /t/pos/till/open` - Open till session
- `POST /t/pos/till/close` - Close till session
- `GET /t/pos/orders` - List orders (filter by tillSessionId)
- `POST /t/pos/orders` - Create order

---

## 📝 Example Integration

```javascript
// React/Vue component example
async function loadCashierSession() {
  try {
    const response = await api.get('/t/pos/till/session');
    const { result } = response.data;
    
    // Update state
    setCashier(result.user);
    setTillSession(result.tillSession);
    setStats(result.stats);
    setBranch(result.branch);
    
    // Check if till is open
    if (!result.session.hasTillSession) {
      showNotification('Please open your till to start taking orders');
    }
    
  } catch (error) {
    if (error.response?.status === 401) {
      // Token expired, redirect to login
      redirectToLogin();
    } else {
      showError('Failed to load session data');
    }
  }
}
```

---

**Created:** December 21, 2025  
**Status:** ✅ Production Ready  
**Version:** 1.0
