# Accept Invite - Public Endpoint

## Overview

The `/t/auth/accept-invite` endpoint is **PUBLIC** and does NOT require authentication or `x-tenant-id` header.

## Why It's Public

Staff members receive a token from their admin but don't know their tenant slug. This endpoint searches all tenants to find the token automatically.

## How It Works

```
1. Admin creates staff → User created with resetToken in tenant DB
2. Admin shares token with staff member (email, SMS, etc.)
3. Staff calls /t/auth/accept-invite with token + password
4. System searches all tenant DBs to find the token
5. Password is set and account activated
6. TenantUserDirectory updated for future logins
```

## API Usage

### Endpoint
```
POST /t/auth/accept-invite
```

### Request (NO HEADERS REQUIRED)
```json
{
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
| Token invalid or expired | Wrong token or expired | Get new token from admin |
| token and password are required | Missing fields | Provide both fields |

## Example

```bash
curl -X POST "http://localhost:3003/t/auth/accept-invite" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "abc123",
    "password": "MySecurePassword123!"
  }'
```

## Implementation Details

- System searches all active tenants for the token
- Token validated in tenant DB (`resetToken` field)
- No `tenantContext` middleware applied to this route
- Already configured as public in `middlewares/Base.js`
- TenantUserDirectory synced after successful password set

## Files Modified

1. `features/tenant-auth/services/TenantAuthService.js`
   - `acceptInvite()` searches all tenants for token
   - Updates password and activates user
   - Syncs TenantUserDirectory

2. `features/tenant-auth/controller/TenantAuthController.js`
   - Only requires `token` and `password`
   - No `tenantContext` middleware applied
   - Updated Swagger docs

## Security

- Token must be valid and not expired in tenant DB
- Password hashed with bcrypt before storage
- One-time use (token cleared after successful use)
- Searches only active tenants (status != 'deleted')

