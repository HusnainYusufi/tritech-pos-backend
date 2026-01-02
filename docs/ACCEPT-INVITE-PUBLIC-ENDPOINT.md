# Accept Invite - Public Endpoint

## Overview

The `/t/auth/accept-invite` endpoint is **PUBLIC** and does NOT require authentication or `x-tenant-id` header.

## Why It's Public

Staff members receive a token from their admin but don't know their tenant slug. This endpoint resolves the tenant automatically from their email address.

## How It Works

```
1. Admin creates staff → User created with resetToken in tenant DB
2. Admin shares token with staff member (email, SMS, etc.)
3. Staff calls /t/auth/accept-invite with email + token + password
4. System looks up email in TenantUserDirectory (main DB) → gets tenant slug
5. System connects to tenant DB and validates token
6. Password is set and account activated
```

## API Usage

### Endpoint
```
POST /t/auth/accept-invite
```

### Request (NO HEADERS REQUIRED)
```json
{
  "email": "staff@restaurant.com",
  "token": "abc123def456...",
  "password": "SecurePass123!",
  "fullName": "John Doe" // optional
}
```

### Response
```json
{
  "status": 200,
  "message": "Password set successfully. You can now login.",
  "result": {
    "email": "staff@restaurant.com",
    "tenantSlug": "restaurant-xyz"
  }
}
```

## Error Cases

| Error | Cause | Solution |
|-------|-------|----------|
| User not found | Email not in TenantUserDirectory | Admin must create staff first |
| Token invalid or expired | Wrong token or expired | Get new token from admin |
| email, token and password are required | Missing fields | Provide all required fields |

## Example

```bash
curl -X POST "http://localhost:3003/t/auth/accept-invite" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "staff@restaurant.com",
    "token": "abc123",
    "password": "MySecurePassword123!"
  }'
```

## Implementation Details

- Tenant resolved from `TenantUserDirectory` in main DB
- Token validated in tenant DB (`resetToken` field)
- No `tenantContext` middleware applied to this route
- Already configured as public in `middlewares/Base.js`

## Files Modified

1. `features/tenant-auth/services/TenantAuthService.js`
   - `acceptInvite()` now accepts `email` parameter
   - Looks up tenant from email in TenantUserDirectory
   - Validates token in tenant DB

2. `features/tenant-auth/controller/TenantAuthController.js`
   - Updated to require `email` in request body
   - No `tenantContext` middleware applied
   - Updated Swagger docs

## Security

- Email must exist in TenantUserDirectory (staff must be created first)
- Token must be valid and not expired in tenant DB
- Password hashed with bcrypt before storage
- One-time use (token cleared after successful use)

