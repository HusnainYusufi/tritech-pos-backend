# Branch POS Configuration - Quick Start

## 🎯 What Was Implemented

A **branch-level POS configuration system** that allows you to control:
- **Payment workflow mode** (Pay Now vs Pay Later)
- **Receipt customization** (logo, footer, QR codes, tax display)
- **Payment method settings** (per-method tax rates)

---

## 🔑 Key Points

1. **This is primarily a FRONTEND feature** - Backend just provides config settings
2. **Same API for both payment modes** - `POST /t/pos/orders` works with or without payment
3. **Config is auto-delivered on login** - No extra API calls needed
4. **Changes take effect immediately** - All cashiers in the branch see updates

---

## 📡 API Summary

### Get Config
```bash
GET /t/branches/{branchId}/pos-config
```

### Update Config
```bash
PUT /t/branches/{branchId}/pos-config
```

### Login (Enhanced)
```bash
POST /t/auth/login-pin
# Response now includes branchConfig
```

### ME API (Enhanced)
```bash
GET /t/auth/me
# Response now includes branchConfig
```

---

## 🎨 Frontend Integration

### 1. Get Config After Login

```javascript
const { result } = await loginWithPin(pin, terminalId);
const { branchConfig } = result;

// Store in state
setConfig(branchConfig);
```

### 2. Conditional Payment Flow

```javascript
if (branchConfig.paymentMode === 'payNow') {
  // KFC Mode: Show payment immediately
  handleCheckout() {
    showPaymentModal();
  }
}

if (branchConfig.paymentMode === 'payLater') {
  // Fine Dining: Send to kitchen, pay later
  handleCheckout() {
    sendToKitchen(); // No payment yet
  }
}
```

### 3. Submit Order

```javascript
// Same API for both modes
await fetch('/t/pos/orders', {
  method: 'POST',
  body: JSON.stringify({
    branchId: branchConfig.branchId,
    items: cart.items,
    // Payment is optional
    paymentMethod: payment?.method,
    amountPaid: payment?.amount
  })
});
```

---

## 🔧 Configuration Options

### Payment Modes

| Mode | Behavior |
|------|----------|
| `payNow` | Payment screen shows immediately (KFC style) |
| `payLater` | Order sent to kitchen first, pay later (fine dining) |

### Receipt Customization

```json
{
  "receiptConfig": {
    "showLogo": true,
    "logoUrl": "https://example.com/logo.png",
    "headerText": "Welcome!",
    "footerText": "Thank you!",
    "showTaxBreakdown": true,
    "showItemCodes": false,
    "showQRCode": false,
    "qrCodeData": "",
    "paperWidth": 80,
    "fontSizeMultiplier": 1.0
  }
}
```

### Payment Method Settings

```json
{
  "paymentMethods": {
    "cash": {
      "enabled": true,
      "taxRateOverride": 5
    },
    "card": {
      "enabled": true,
      "taxRateOverride": 16,
      "minAmount": 0
    },
    "mobile": {
      "enabled": true,
      "taxRateOverride": null
    }
  }
}
```

---

## 📝 Example Configurations

### Fast Food (Pay Now)

```json
{
  "paymentMode": "payNow",
  "enableTableService": false,
  "receiptConfig": {
    "showLogo": true,
    "footerText": "Thank you! Visit again!"
  }
}
```

### Fine Dining (Pay Later)

```json
{
  "paymentMode": "payLater",
  "enableTableService": true,
  "receiptConfig": {
    "showLogo": true,
    "headerText": "Fine Dining Experience",
    "footerText": "We hope you enjoyed your meal!",
    "showQRCode": true,
    "qrCodeData": "https://restaurant.com/feedback"
  }
}
```

---

## 🧪 Quick Test

### 1. Login and Check Config

```bash
curl -X POST http://localhost:3004/t/auth/login-pin \
  -H "Content-Type: application/json" \
  -d '{"pin": "123456", "terminalId": "terminal_123"}'

# Look for branchConfig in response
```

### 2. Update Config

```bash
curl -X PUT http://localhost:3004/t/branches/{branchId}/pos-config \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-id: TENANT_SLUG" \
  -H "Content-Type: application/json" \
  -d '{"paymentMode": "payLater"}'
```

### 3. Create Order Without Payment

```bash
curl -X POST http://localhost:3004/t/pos/orders \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-id: TENANT_SLUG" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "...",
    "items": [{"menuItemId": "...", "quantity": 1}]
  }'

# Order created with status='placed' (unpaid)
```

---

## ✅ What's Working

1. ✅ Branch schema extended with `posConfig` fields
2. ✅ `GET/PUT /t/branches/:id/pos-config` endpoints
3. ✅ `POST /t/auth/login-pin` returns `branchConfig`
4. ✅ `GET /t/auth/me` returns `branchConfig`
5. ✅ Payment is optional in order creation
6. ✅ Receipt generation uses `receiptConfig`
7. ✅ Payment method tax overrides work
8. ✅ No linting errors

---

## 🚀 Next Steps for Frontend

1. **Read config on login** - Store in state/context
2. **Implement conditional UI** - Show payment at different times based on `paymentMode`
3. **Use receipt config** - Apply logo, footer, QR codes when printing
4. **Handle payment methods** - Show/hide based on `paymentMethods.*.enabled`

---

## 📚 Full Documentation

See [BRANCH_POS_CONFIGURATION.md](./BRANCH_POS_CONFIGURATION.md) for complete details.

---

**That's it! The backend is ready. Frontend just needs to read the config and adjust the UI accordingly.** 🎉

