# 🛒 Cashier Quick Reference Card

## 🔐 Step 1: Login with PIN

```bash
POST /t/auth/login-pin
{
  "pin": "1234",
  "branchId": "YOUR_BRANCH_ID",
  "posId": "YOUR_POS_ID"
}
```

**Save the token!**

---

## 💰 Step 2: Open Till

```bash
POST /t/pos/till/open
Headers: Authorization: Bearer <TOKEN>
{
  "openingAmount": 100.00
}
```

**Get new token with tillSessionId!**

---

## 🛍️ Step 3: Take Order

```bash
POST /t/pos/orders?printReceipt=true
Headers: Authorization: Bearer <TOKEN>
{
  "items": [
    { "menuItemId": "...", "quantity": 2 }
  ],
  "paymentMethod": "cash",
  "amountPaid": 50.00
}
```

**Receipt included in response!**

---

## 🧾 Step 4: Print Receipt (Optional)

```bash
POST /t/pos/orders/:id/print
Headers: Authorization: Bearer <TOKEN>
{
  "format": "thermal"
}
```

---

## 📋 Step 5: View Orders

```bash
GET /t/pos/orders?page=1&limit=20
Headers: Authorization: Bearer <TOKEN>
```

---

## 🔒 Step 6: Close Till

```bash
POST /t/pos/till/close
Headers: Authorization: Bearer <TOKEN>
{
  "declaredClosingAmount": 1547.50,
  "systemClosingAmount": 1550.00
}
```

---

## ⚡ Quick Tips

### Payment Methods
- `cash` - Cash payment
- `card` - Card payment
- `mobile` - Mobile payment
- `split` - Split payment

### Receipt Formats
- `html` - Web/email receipt
- `text` - Plain text
- `thermal` - Thermal printer

### Order Status
- `placed` - Not paid yet
- `paid` - Payment complete
- `void` - Cancelled
- `refunded` - Refunded

---

## ⚠️ Common Errors

| Error | Solution |
|-------|----------|
| Insufficient permissions | Contact manager |
| No open till session | Open till first |
| Menu item not available | Check with manager |
| Insufficient stock | Check inventory |

---

## 📞 Help

**Support**: support@tritechtechnologyllc.com  
**Documentation**: `/docs/POS_ORDER_FLOW_COMPLETE.md`

---

**Quick Reference v1.0** | Tritech POS

