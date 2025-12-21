# 📮 Postman Quick Reference - Cashier Session

## 🎯 The Endpoint

```
GET http://localhost:3003/t/pos/till/session
```

---

## 📥 Request

### Method
```
GET
```

### Headers
```
Authorization: Bearer YOUR_JWT_TOKEN
x-tenant-id: extraction-testt
```

### Body
```
(empty - no body needed)
```

---

## 📤 Response (200 OK)

```json
{
  "status": 200,
  "message": "OK",
  "result": {
    "user": {
      "fullName": "John Doe",
      "email": "john@example.com",
      "roles": ["cashier"],
      "position": "Cashier"
    },
    "session": {
      "hasTillSession": true,
      "tillSessionId": "65d..."
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
      "name": "Main Branch",
      "code": "BR-001"
    },
    "stats": {
      "totalOrders": 15,
      "totalSales": 1250.50,
      "totalCash": 850.00,
      "totalCard": 300.50,
      "currentBalance": 950.00,
      "sessionDuration": 180
    }
  }
}
```

---

## 🔑 Key Fields

| Field | Description |
|-------|-------------|
| `result.user.fullName` | Cashier name |
| `result.session.hasTillSession` | Is till open? (boolean) |
| `result.stats.currentBalance` | Current till balance |
| `result.stats.totalOrders` | Orders in this session |
| `result.stats.totalSales` | Total sales amount |
| `result.stats.sessionDuration` | Minutes since opened |

---

## 🚀 Quick Test in Postman

1. **Create New Request**
   - Method: `GET`
   - URL: `http://localhost:3003/t/pos/till/session`

2. **Add Headers**
   - Key: `Authorization`, Value: `Bearer YOUR_TOKEN`
   - Key: `x-tenant-id`, Value: `extraction-testt`

3. **Click Send** ✨

---

## 📦 Import Collection

**File:** `docs/postman/cashier-session.postman_collection.json`

1. Postman → Import
2. Select file
3. Done! 6 ready-to-use requests

---

## ⚡ cURL Version

```bash
curl -X GET "http://localhost:3003/t/pos/till/session" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-tenant-id: extraction-testt"
```

---

## 🎯 Use Cases

**Dashboard:** Get all data on app load
```javascript
const { result } = await api.get('/t/pos/till/session');
showDashboard(result);
```

**Check Till Status:**
```javascript
if (!result.session.hasTillSession) {
  showOpenTillPrompt();
}
```

**Show Balance:**
```javascript
const balance = result.stats?.currentBalance || 0;
displayBalance(balance);
```

---

## ✅ What You Get

- ✅ User details
- ✅ Till session info
- ✅ Current balance
- ✅ Order statistics
- ✅ Terminal info
- ✅ Branch info
- ✅ Session duration

**All in ONE call!** 🎉
