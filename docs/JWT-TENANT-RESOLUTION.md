# JWT-Based Tenant Resolution

## Overview

The system now uses **JWT-based tenant resolution** to eliminate the need for `x-tenant-id` header on authenticated requests. The tenant is automatically extracted from the email domain during login and embedded in the JWT token.

---

## How It Works

### Priority Order

The system resolves tenant from multiple sources in this priority:

1. **JWT Token** (authenticated requests) - Extract `tenantSlug` from token
2. **Email Domain** (login endpoints) - Extract tenant from email (e.g., `john@acme.com` → `acme`)
3. **x-tenant-id Header** (public endpoints) - Use header value
4. **Subdomain** (web apps) - Extract from hostname (e.g., `acme.yourapp.com` → `acme`)

### Flow Diagram

```
Login Request
  ↓
Extract tenant from email (john@acme.com → acme)
  ↓
Validate tenant exists in database
  ↓
Authenticate user
  ↓
Generate JWT with tenantSlug embedded
  ↓
Return JWT to client
  ↓
Subsequent Requests
  ↓
Extract tenantSlug from JWT
  ↓
Connect to tenant database
  ↓
Process request
```

---

## API Changes

### Login Endpoint

**Before:**
```http
POST /t/auth/login
Headers:
  x-tenant-id: acme
Body:
  {
    "email": "john@acme.com",
    "password": "pass123"
  }
```

**After:**
```http
POST /t/auth/login
Body:
  {
    "email": "john@acme.com",
    "password": "pass123"
  }
```

**Note:** Tenant is automatically extracted from email domain (`acme.com` → `acme`)

### Authenticated Requests

**Before:**
```http
GET /t/pos/orders
Headers:
  Authorization: Bearer <token>
  x-tenant-id: acme
```

**After:**
```http
GET /t/pos/orders
Headers:
  Authorization: Bearer <token>
```

**Note:** Tenant is automatically extracted from JWT token

---

## Email-to-Tenant Mapping

### Valid Formats

- `user@acme.com` → tenant: `acme`
- `admin@downtown-cafe.com` → tenant: `downtown-cafe`
- `cashier@store123.com` → tenant: `store123`

### Invalid Formats

- `user@gmail.com` → Error (generic domain)
- `admin@localhost` → Error (no valid domain)
- `test@` → Error (incomplete email)

### Rules

- Tenant slug must be alphanumeric with hyphens: `[a-z0-9-]+`
- Must match existing tenant in database
- Case-insensitive

---

## JWT Token Structure

### New Token Payload

```javascript
{
  "tenant": true,
  "tenantSlug": "acme",  // NEW: Tenant identifier
  "uid": "65c...",
  "email": "john@acme.com",
  "roles": ["cashier"],
  "branchId": "65a...",
  "posId": "65b...",
  "iat": 1234567890,
  "exp": 1234567890
}
```

---

## Public Endpoints

These endpoints support both subdomain and `x-tenant-id` header:

- `GET /t/branches` - List branches
- `GET /t/pos/terminals` - List terminals

**Usage:**

```http
# Option 1: Using header
GET /t/branches
Headers:
  x-tenant-id: acme

# Option 2: Using subdomain
GET https://acme.yourapp.com/t/branches
```

---

## Error Handling

### Missing Tenant

```json
{
  "status": 400,
  "message": "Missing tenant identifier. Provide email, x-tenant-id header, or use tenant subdomain."
}
```

### Tenant Not Found

```json
{
  "status": 404,
  "message": "Tenant \"acme\" not found"
}
```

### Invalid Email Domain

```json
{
  "status": 400,
  "message": "Missing tenant identifier. Provide email, x-tenant-id header, or use tenant subdomain."
}
```

---

## Migration Guide

### For Frontend Developers

1. **Remove `x-tenant-id` header** from all authenticated requests
2. **Keep email format** matching tenant slug (e.g., `user@acme.com` for tenant `acme`)
3. **Update login flow** to not require tenant selection

### For API Clients

1. **Login:** Send email with domain matching tenant slug
2. **Subsequent requests:** Only send JWT token in Authorization header
3. **Public endpoints:** Can use either `x-tenant-id` header or subdomain

---

## Testing

### Test Login Flow

```bash
# Login (tenant extracted from email)
curl -X POST http://localhost:3003/t/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@acme.com",
    "password": "pass123"
  }'

# Response includes JWT with tenantSlug
{
  "status": 200,
  "message": "Login successful",
  "result": {
    "token": "eyJhbGc...",
    "user": {...}
  }
}
```

### Test Authenticated Request

```bash
# Use JWT only (no x-tenant-id needed)
curl -X GET http://localhost:3003/t/pos/orders \
  -H "Authorization: Bearer eyJhbGc..."
```

---

## Troubleshooting

### Issue: "Missing tenant identifier"

**Cause:** Email domain doesn't match tenant slug or JWT is invalid

**Solution:** 
- Ensure email domain matches tenant slug (e.g., `user@acme.com` for tenant `acme`)
- Check JWT token is valid and contains `tenantSlug`

### Issue: "Tenant not found"

**Cause:** Tenant doesn't exist in database

**Solution:**
- Verify tenant exists: `db.tenants.findOne({ slug: "acme" })`
- Check email domain matches tenant slug

### Issue: Old tokens not working

**Cause:** Tokens generated before this update don't have `tenantSlug`

**Solution:**
- Users must login again to get new tokens with `tenantSlug`

---

## Security Considerations

1. **Email Validation:** Email domain must match existing tenant
2. **JWT Security:** Tokens are signed with `JWT_SECRET_KEY`
3. **Tenant Isolation:** Each tenant has separate database
4. **No Cross-Tenant Access:** JWT contains tenant identifier, preventing cross-tenant access

---

## Related Documentation

- [Cashier Authentication Architecture](./CASHIER-AUTHENTICATION-ARCHITECTURE.md)
- [Migration Guide V2](./MIGRATION-GUIDE-V2.md)
- [POS Order Flow](./POS_ORDER_FLOW_COMPLETE.md)

