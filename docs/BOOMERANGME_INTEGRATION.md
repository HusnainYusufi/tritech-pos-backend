# Boomerangme Loyalty Platform Integration

This document describes how to set up and use the Boomerangme loyalty platform integration with Tritech POS.

## Overview

[Boomerangme](https://boomerangme.cards) is a digital loyalty card platform that provides:
- Stamp cards (Buy X, get 1 free)
- Cashback programs
- Gift cards
- Membership cards
- Coupons and rewards

This integration allows Tritech POS to:
1. **Expose menu inventory** to Boomerangme for item-based loyalty rules
2. **Trigger loyalty accruals** when orders are completed
3. **Reverse loyalty** when orders are refunded

## Architecture

```
┌─────────────────────┐         ┌─────────────────────┐
│   Boomerangme       │         │   Tritech POS       │
│   Platform          │         │   Backend           │
├─────────────────────┤         ├─────────────────────┤
│                     │ ──────► │ POST /check-credentials │
│                     │ ──────► │ POST /get-inventory     │
│                     │         │                         │
│ POST /accrue        │ ◄────── │ Webhook: order-completed│
│ POST /reverse       │ ◄────── │ Webhook: order-refunded │
└─────────────────────┘         └─────────────────────┘
```

## Setup Guide

### Step 1: Get Boomerangme Credentials

1. Log in to your Boomerangme dashboard
2. Navigate to **Settings → Apps**
3. Create a new application:
   - Name: "Tritech POS"
   - Check Credentials URL: `https://your-api.com/integrations/boomerangme/check-credentials`
   - Get Inventory URL: `https://your-api.com/integrations/boomerangme/get-inventory`
4. Note your **App Token** (X-App-Token)

### Step 2: Configure Tritech POS

Call the configuration endpoint to set up the integration:

```bash
curl -X PUT "https://your-api.com/integrations/boomerangme/config" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "x-tenant-id: your-tenant-slug" \
  -H "Content-Type: application/json" \
  -d '{
    "isEnabled": true,
    "appToken": "YOUR_BOOMERANGME_APP_TOKEN",
    "credentials": [
      { "name": "tenantSlug", "value": "your-tenant-slug" },
      { "name": "apiKey", "value": "your-secret-api-key" }
    ],
    "webhookSecret": "optional-webhook-secret"
  }'
```

### Step 3: Test the Connection

```bash
curl -X POST "https://your-api.com/integrations/boomerangme/test" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "x-tenant-id: your-tenant-slug"
```

### Step 4: Install in Boomerangme

1. In Boomerangme, go to your app settings
2. Install the app using your tenant credentials
3. Boomerangme will call `/check-credentials` to verify
4. Boomerangme will call `/get-inventory` to fetch your menu

## API Reference

### Inbound Endpoints (Boomerangme calls these)

#### POST /integrations/boomerangme/check-credentials

Validates merchant credentials during app installation.

**Request:**
```json
[
  { "name": "tenantSlug", "value": "acme-restaurant" },
  { "name": "apiKey", "value": "sk_live_xxx" }
]
```

**Response:**
```json
{
  "isValid": true
}
```

#### POST /integrations/boomerangme/get-inventory

Returns menu structure for item-based loyalty rules.

**Request:**
```json
[
  { "name": "tenantSlug", "value": "acme-restaurant" },
  { "name": "apiKey", "value": "sk_live_xxx" }
]
```

**Response:**
```json
{
  "inventoryItems": [
    {
      "type": "group",
      "id": "cat_123",
      "title": "Burgers",
      "items": [
        {
          "type": "item",
          "id": "item_456",
          "title": "Classic Burger",
          "price": 12.99
        }
      ]
    }
  ]
}
```

### Webhook Endpoints (Your system calls these)

#### POST /integrations/boomerangme/webhook/order-completed

Trigger loyalty accrual after an order is paid.

**Headers:**
- `Authorization: Bearer <jwt>` or `x-tenant-id: <tenant-slug>`

**Request:**
```json
{
  "orderId": "507f1f77bcf86cd799439011",
  "customerPhone": "+1234567890",
  "customerEmail": "john@example.com",
  "webhookSecret": "optional-secret"
}
```

**Response:**
```json
{
  "status": 200,
  "message": "Loyalty accrual successful",
  "result": {
    "transactionId": "txn_123",
    "results": [
      {
        "isSuccess": true,
        "cardType": 1,
        "serialNumber": "CARD123",
        "accrualAmount": 1,
        "accruedValue": 5
      }
    ]
  }
}
```

#### POST /integrations/boomerangme/webhook/order-refunded

Reverse loyalty when an order is refunded.

**Request:**
```json
{
  "orderId": "507f1f77bcf86cd799439011",
  "transactionId": "txn_123",
  "webhookSecret": "optional-secret"
}
```

### Admin Endpoints

#### GET /integrations/boomerangme/config

Get current configuration (sensitive fields masked).

#### PUT /integrations/boomerangme/config

Update configuration.

#### POST /integrations/boomerangme/test

Test connection to Boomerangme API.

## Frontend Integration

To trigger loyalty accruals from your frontend after a successful order:

```javascript
// After order is paid successfully
async function triggerLoyalty(orderId, customerPhone) {
  try {
    const response = await fetch('/integrations/boomerangme/webhook/order-completed', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': tenantSlug,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        orderId,
        customerPhone
      })
    });
    
    const result = await response.json();
    
    if (result.status === 200) {
      // Show loyalty rewards to customer
      console.log('Loyalty points awarded:', result.result);
    }
  } catch (error) {
    // Don't block the order flow if loyalty fails
    console.error('Loyalty accrual failed:', error);
  }
}
```

## Credentials Security

The `credentials` array stores the values that Boomerangme sends to identify your tenant. You define these yourself:

| Credential | Purpose |
|------------|---------|
| `tenantSlug` | Identifies which tenant in multi-tenant setup |
| `apiKey` | Secret key for authentication |

**Important:** Keep your `apiKey` secret. It's transmitted over HTTPS but should not be exposed to end users.

## Troubleshooting

### "Invalid credentials" error

1. Check that `isEnabled` is `true` in your config
2. Verify credentials match exactly (case-sensitive)
3. Check logs for detailed error messages

### Accrual not working

1. Verify `appToken` is correct
2. Test connection using `/test` endpoint
3. Check that order has `customerPhone` or provide it in webhook call
4. Check Boomerangme dashboard for error logs

### Inventory not syncing

1. Ensure menu items are `isActive: true`
2. Check that credentials are valid
3. Look for errors in server logs

## Support

- Boomerangme API Docs: https://docs.dev.boomerangme.cards/#tag/Marketplace-API
- Boomerangme Support: https://boomerangme.cards/support
