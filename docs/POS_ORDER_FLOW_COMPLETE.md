# 🛒 Complete POS Order Flow - Production Guide

## 📋 Overview

This document describes the **complete, production-ready POS order flow** for cashiers taking orders at the point of sale.

---

## 🔄 Complete Cashier Workflow

### **Step 1: Cashier Login with PIN**

```bash
POST /t/auth/login-pin
Headers:
  x-tenant-id: acme
  Content-Type: application/json

Body:
{
  "pin": "1234",
  "branchId": "65a...",
  "posId": "65b..."
}

Response:
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
      "branchIds": ["65a..."]
    },
    "branchId": "65a...",
    "tillSessionId": null  // ← No till session yet
  }
}
```

**Save the JWT token for subsequent requests!**

---

### **Step 2: Open Till Session**

```bash
POST /t/pos/till/open
Headers:
  Authorization: Bearer <JWT_TOKEN>
  x-tenant-id: acme
  Content-Type: application/json

Body:
{
  "branchId": "65a...",
  "posId": "65b...",
  "openingAmount": 100.00,
  "notes": "Starting shift"
}

Response:
{
  "status": 200,
  "message": "Till opened successfully",
  "result": {
    "token": "eyJhbGc...",  // ← NEW TOKEN with tillSessionId
    "tillSession": {
      "_id": "65d...",
      "staffId": "65c...",
      "branchId": "65a...",
      "posId": "65b...",
      "status": "open",
      "openingAmount": 100.00,
      "openedAt": "2024-01-15T10:00:00.000Z"
    }
  }
}
```

**Update your JWT token - it now includes tillSessionId!**

---

### **Step 3: Take Orders**

#### **3A. Simple Cash Order**

```bash
POST /t/pos/orders?printReceipt=true&receiptFormat=html
Headers:
  Authorization: Bearer <JWT_TOKEN>
  x-tenant-id: acme
  Content-Type: application/json

Body:
{
  "items": [
    {
      "menuItemId": "65e...",
      "quantity": 2,
      "notes": "No onions"
    },
    {
      "menuItemId": "65f...",
      "quantity": 1
    }
  ],
  "customerName": "Walk-in Customer",
  "paymentMethod": "cash",
  "amountPaid": 50.00
}

Response:
{
  "status": 201,
  "message": "Order placed and paid",
  "result": {
    "id": "65g...",
    "orderNumber": "ORD-20240115-0001",
    "status": "paid",
    "totals": {
      "subTotal": 45.00,
      "taxTotal": 2.25,
      "discount": 0,
      "grandTotal": 47.25
    },
    "payment": {
      "method": "cash",
      "amountPaid": 50.00,
      "change": 2.75,
      "paidAt": "2024-01-15T10:15:00.000Z"
    },
    "items": [...],
    "branchId": "65a...",
    "posId": "65b...",
    "createdAt": "2024-01-15T10:15:00.000Z",
    "receipt": {
      "format": "html",
      "content": "<!DOCTYPE html>...",
      "data": {...}
    }
  }
}
```

**✅ Order created, inventory deducted, receipt generated!**

---

#### **3B. Order with Customer Details**

```bash
POST /t/pos/orders
Headers:
  Authorization: Bearer <JWT_TOKEN>
  x-tenant-id: acme

Body:
{
  "items": [
    {
      "menuItemId": "65e...",
      "quantity": 3
    }
  ],
  "customerName": "Ahmed Ali",
  "customerPhone": "+966501234567",
  "notes": "For delivery",
  "paymentMethod": "card",
  "amountPaid": 75.50
}
```

---

#### **3C. Unpaid Order (Pay Later)**

```bash
POST /t/pos/orders
Headers:
  Authorization: Bearer <JWT_TOKEN>
  x-tenant-id: acme

Body:
{
  "items": [
    {
      "menuItemId": "65e...",
      "quantity": 1
    }
  ],
  "customerName": "Table 5",
  "paymentMethod": "cash",
  "amountPaid": 0  // ← Not paid yet
}

Response:
{
  "status": 201,
  "message": "Order placed",
  "result": {
    "id": "65h...",
    "orderNumber": "ORD-20240115-0002",
    "status": "placed",  // ← Status is "placed", not "paid"
    "totals": {
      "grandTotal": 25.00
    },
    "payment": {
      "method": "cash",
      "amountPaid": 0,
      "change": 0,
      "paidAt": null
    }
  }
}
```

---

### **Step 4: Print Receipt (Anytime)**

```bash
POST /t/pos/orders/65g.../print
Headers:
  Authorization: Bearer <JWT_TOKEN>
  x-tenant-id: acme

Body:
{
  "format": "thermal"  // or "html" or "text"
}

Response:
{
  "status": 200,
  "message": "Receipt generated successfully",
  "result": {
    "format": "thermal",
    "content": "========================================\n...",
    "data": {
      "orderNumber": "ORD-20240115-0001",
      "orderDate": "15/01/2024 10:15:00",
      ...
    }
  }
}
```

---

### **Step 5: View Orders**

#### **5A. List Today's Orders**

```bash
GET /t/pos/orders?startDate=2024-01-15T00:00:00Z&endDate=2024-01-15T23:59:59Z&page=1&limit=20
Headers:
  Authorization: Bearer <JWT_TOKEN>
  x-tenant-id: acme

Response:
{
  "status": 200,
  "message": "OK",
  "result": {
    "orders": [
      {
        "_id": "65g...",
        "orderNumber": "ORD-20240115-0001",
        "status": "paid",
        "totals": {
          "grandTotal": 47.25
        },
        "branchId": {
          "name": "Main Branch",
          "code": "MAIN"
        },
        "staffId": {
          "fullName": "John Doe"
        },
        "createdAt": "2024-01-15T10:15:00.000Z"
      },
      ...
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

#### **5B. Get Order Details**

```bash
GET /t/pos/orders/65g...
Headers:
  Authorization: Bearer <JWT_TOKEN>
  x-tenant-id: acme

Response:
{
  "status": 200,
  "message": "OK",
  "result": {
    "_id": "65g...",
    "orderNumber": "ORD-20240115-0001",
    "status": "paid",
    "customerName": "Walk-in Customer",
    "items": [
      {
        "menuItemId": "65e...",
        "nameSnapshot": "Margherita Pizza",
        "quantity": 2,
        "unitPrice": 15.00,
        "lineTotal": 30.00,
        "notes": "No onions"
      },
      ...
    ],
    "totals": {
      "subTotal": 45.00,
      "taxTotal": 2.25,
      "discount": 0,
      "grandTotal": 47.25
    },
    "payment": {
      "method": "cash",
      "amountPaid": 50.00,
      "change": 2.75,
      "paidAt": "2024-01-15T10:15:00.000Z"
    },
    "branchId": {...},
    "staffId": {...},
    "posId": {...},
    "createdAt": "2024-01-15T10:15:00.000Z"
  }
}
```

---

### **Step 6: Close Till Session (End of Shift)**

```bash
POST /t/pos/till/close
Headers:
  Authorization: Bearer <JWT_TOKEN>
  x-tenant-id: acme

Body:
{
  "declaredClosingAmount": 1547.50,
  "systemClosingAmount": 1550.00,
  "cashCounts": {
    "500": 2,
    "100": 5,
    "50": 4,
    "20": 10,
    "10": 5,
    "5": 9,
    "1": 2
  },
  "notes": "End of shift"
}

Response:
{
  "status": 200,
  "message": "Till session closed",
  "result": {
    "token": "eyJhbGc...",  // ← NEW TOKEN without tillSessionId
    "tillSessionId": "65d...",
    "variance": -2.50,  // ← Short by 2.50
    "declaredClosingAmount": 1547.50,
    "systemClosingAmount": 1550.00
  }
}
```

---

## 🔐 Permissions Required

### **Cashier Role Permissions**

```javascript
{
  "role": "cashier",
  "scope": "branch",
  "permissions": [
    "pos.orders.create",      // ✅ Create orders
    "pos.orders.read",        // ✅ View orders
    "pos.orders.manage",      // ✅ Manage orders
    "pos.till.manage",        // ✅ Open/close till
    "pos.menu.read",          // ✅ View menu
    "menu.items.read",        // ✅ Read menu items
    "payments.take",          // ✅ Process payments
    "customers.read"          // ✅ View customer info
  ]
}
```

---

## 🔄 What Happens Automatically

### **When Order is Created:**

1. ✅ **Order Number Generated** - Unique sequential number (ORD-20240115-0001)
2. ✅ **Menu Items Validated** - Checks availability and pricing
3. ✅ **Pricing Calculated** - From branch menu configuration
4. ✅ **Tax Calculated** - Based on branch tax settings
5. ✅ **Payment Processed** - Calculates change if overpaid
6. ✅ **Inventory Deducted** - Automatic stock deduction via recipes
7. ✅ **Till Session Linked** - Associates order with cashier's till
8. ✅ **Receipt Generated** - If printReceipt=true

---

## 📊 Order Status Flow

```
placed → paid → void → refunded
  ↓       ↓      ↓        ↓
 New   Paid   Cancelled  Refunded
```

- **placed**: Order created, not paid yet
- **paid**: Payment received, order complete
- **void**: Order cancelled before payment
- **refunded**: Order refunded after payment

---

## 💰 Payment Methods

- **cash**: Cash payment
- **card**: Credit/debit card
- **mobile**: Mobile payment (Apple Pay, Google Pay, etc.)
- **split**: Split payment (multiple methods)

---

## 🧾 Receipt Formats

### **1. HTML Receipt** (Web/Email)
```bash
?receiptFormat=html
```
- Beautiful formatted receipt
- Printable from browser
- Can be emailed to customer

### **2. Text Receipt** (Thermal Printer)
```bash
?receiptFormat=text
```
- Plain text, 42 characters wide
- Compatible with thermal printers
- ESC/POS ready

### **3. Thermal Receipt** (ESC/POS)
```bash
?receiptFormat=thermal
```
- Includes printer commands
- Direct thermal printer output
- Auto-cut support

---

## 🔍 Order Filtering & Search

### **Filter by Branch**
```bash
GET /t/pos/orders?branchId=65a...
```

### **Filter by Status**
```bash
GET /t/pos/orders?status=paid
```

### **Filter by Date Range**
```bash
GET /t/pos/orders?startDate=2024-01-15T00:00:00Z&endDate=2024-01-15T23:59:59Z
```

### **Filter by Staff**
```bash
GET /t/pos/orders?staffId=65c...
```

### **Filter by Till Session**
```bash
GET /t/pos/orders?tillSessionId=65d...
```

### **Combine Filters**
```bash
GET /t/pos/orders?branchId=65a...&status=paid&startDate=2024-01-15T00:00:00Z&page=1&limit=50
```

---

## ⚠️ Common Errors & Solutions

### **Error: "Insufficient permissions"**
**Solution**: Ensure cashier role has `pos.orders.create` permission

### **Error: "No open till session"**
**Solution**: Open till session first with `POST /t/pos/till/open`

### **Error**: "Menu item not available for sale"**
**Solution**: Check menu item is active and synced to branch

### **Error: "branchId is required"**
**Solution**: Include branchId in request or ensure it's in JWT token

### **Error: "Insufficient stock"**
**Solution**: Check branch inventory levels for recipe ingredients

---

## 📱 Mobile POS Integration

### **Recommended Flow:**

1. **Login Screen** → PIN login
2. **Till Open Screen** → Open till with opening amount
3. **Order Screen** → Select items, add to cart
4. **Payment Screen** → Enter amount, select method
5. **Receipt Screen** → Show receipt, print option
6. **Orders List** → View today's orders
7. **Till Close Screen** → Count cash, close till

---

## 🎯 Best Practices

### **1. Always Open Till Before Taking Orders**
```javascript
// ❌ BAD: Take order without till
POST /t/pos/orders

// ✅ GOOD: Open till first
POST /t/pos/till/open
POST /t/pos/orders
```

### **2. Auto-Print Receipts**
```javascript
// ✅ GOOD: Print receipt with order
POST /t/pos/orders?printReceipt=true&receiptFormat=thermal
```

### **3. Handle Partial Payments**
```javascript
// Order total: 50.00
// Customer pays: 30.00

POST /t/pos/orders
{
  "items": [...],
  "amountPaid": 30.00  // ← Partial payment
}
// Status will be "placed", not "paid"
```

### **4. Close Till at End of Shift**
```javascript
// ✅ GOOD: Always close till
POST /t/pos/till/close
{
  "declaredClosingAmount": 1547.50,
  "systemClosingAmount": 1550.00
}
```

---

## 🚀 Performance Tips

- **Batch Orders**: Process multiple items in one order
- **Cache Menu**: Load menu once, cache locally
- **Offline Mode**: Queue orders, sync when online
- **Receipt Caching**: Cache receipt templates

---

## 📊 Analytics & Reporting

### **Daily Sales Report**
```bash
GET /t/pos/orders?startDate=TODAY&status=paid
```

### **Cashier Performance**
```bash
GET /t/pos/orders?staffId=CASHIER_ID&startDate=TODAY
```

### **Till Reconciliation**
```bash
GET /t/pos/till/sessions?branchId=BRANCH_ID&status=closed&startDate=TODAY
```

---

## 🔒 Security Features

- ✅ **JWT Authentication** - Secure token-based auth
- ✅ **PIN Login** - Quick cashier authentication
- ✅ **Branch Scoping** - Cashiers limited to assigned branches
- ✅ **Till Locking** - One till per cashier at a time
- ✅ **Audit Trail** - All orders tracked with staff ID
- ✅ **Variance Tracking** - Cash discrepancies logged

---

## 📞 Support

For issues or questions:
- **Email**: support@tritechtechnologyllc.com
- **Documentation**: `/docs`
- **API Reference**: `/api-docs`

---

**Version**: 1.0.0  
**Last Updated**: 2024-01-15  
**Status**: ✅ Production-Ready
