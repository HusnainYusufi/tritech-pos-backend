# 🚀 POS Quick Start Guide

## For Cashiers

### 1. Login with PIN
```http
POST /t/auth/login-pin
{
  "pin": "1234",
  "branchId": "YOUR_BRANCH_ID",
  "posId": "YOUR_POS_ID"
}
```

### 2. Open Till
```http
POST /t/pos/till/open
{
  "openingAmount": 100
}
```

### 3. Take Order
```http
POST /t/pos/orders
{
  "items": [
    { "menuItemId": "ITEM_ID", "quantity": 2 }
  ],
  "customerName": "John Doe",
  "paymentMethod": "cash",
  "amountPaid": 50.00
}
```

### 4. Print Receipt
```http
GET /t/pos/orders/:orderId/receipt?format=text
```

### 5. Close Till
```http
POST /t/pos/till/close
{
  "declaredClosingAmount": 1500
}
```

---

## For Developers

### Minimal Order Example
```javascript
const response = await fetch('/t/pos/orders', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwt}`,
    'x-tenant-id': 'acme',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    items: [
      { menuItemId: '65a...', quantity: 1 }
    ],
    paymentMethod: 'cash',
    amountPaid: 20.00
  })
});

const order = await response.json();
console.log(order.result.orderNumber); // ORD-20240115-0001
```

### Get Receipt HTML
```javascript
const receipt = await fetch(`/t/pos/orders/${orderId}/receipt?format=html`, {
  headers: {
    'Authorization': `Bearer ${jwt}`,
    'x-tenant-id': 'acme'
  }
});

const html = await receipt.text();
// Display in iframe or print
```

---

## Common Issues

**Q: Getting "insufficient permissions" error?**  
A: Ensure cashier role has `pos.orders.create` permission

**Q: "No open till session" error?**  
A: Call `/t/pos/till/open` first

**Q: Order number not generating?**  
A: Check branch has `posConfig.orderPrefix` set

**Q: Inventory not deducting?**  
A: Ensure menu items have `recipeId` linked

---

## Quick Reference

| Endpoint | Permission | Purpose |
|----------|-----------|---------|
| `POST /t/pos/orders` | `pos.orders.create` | Create order |
| `GET /t/pos/orders/:id` | `pos.orders.read` | Get order |
| `GET /t/pos/orders/:id/receipt` | `pos.orders.read` | Get receipt |
| `POST /t/pos/till/open` | `pos.till.manage` | Open till |
| `POST /t/pos/till/close` | `pos.till.manage` | Close till |

---

**Full Documentation:** See `POS_ORDER_FLOW_COMPLETE.md`

