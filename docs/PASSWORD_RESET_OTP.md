# Password Reset with OTP - Complete Guide

## 📋 Overview

This document describes the **OTP-based password reset** feature for both **Admin** and **Tenant** users. This is a secure, production-ready implementation that replaces the token-based password reset flow.

---

## 🎯 Key Features

✅ **6-digit OTP** - User-friendly numeric code  
✅ **10-minute expiry** - Security best practice  
✅ **5 verification attempts** - Prevents brute force  
✅ **Rate limiting** - 3 requests per 15 minutes per email  
✅ **Email delivery** - Professional HTML templates  
✅ **Multi-tenant support** - Works for admin and tenant users  
✅ **Automatic cleanup** - Expired OTPs are auto-deleted  
✅ **One-time use** - OTP is invalidated after password reset  

---

## 🏗️ Architecture

### Data Flow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 1. Request OTP
       ▼
┌─────────────────┐
│  API Endpoint   │
└──────┬──────────┘
       │ 2. Generate OTP
       ▼
┌─────────────────┐      ┌──────────────┐
│   OTP Service   │─────▶│   Main DB    │
└──────┬──────────┘      │ (OTP Record) │
       │                 └──────────────┘
       │ 3. Send Email
       ▼
┌─────────────────┐
│  Email Service  │
└──────┬──────────┘
       │ 4. Deliver OTP
       ▼
┌─────────────────┐
│   User Email    │
└─────────────────┘
```

### Database Schema

**Collection:** `PasswordResetOTP` (Main DB)

```javascript
{
  email: "user@example.com",
  otpHash: "$2a$10$...",           // bcrypt hash of OTP
  userType: "admin" | "tenant",
  tenantSlug: "restaurant",        // null for admin users
  attempts: 0,                     // Verification attempts (max 5)
  expiresAt: ISODate("..."),       // 10 minutes from creation
  verified: false,                 // True after successful verification
  verifiedAt: null,
  usedForReset: false,             // True after password reset
  ipAddress: "192.168.1.1",
  userAgent: "Mozilla/5.0...",
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

---

## 🔄 Complete Flow

### 3-Step Process

```
┌─────────────────────────────────────────────────────────────┐
│                    PASSWORD RESET FLOW                       │
└─────────────────────────────────────────────────────────────┘

Step 1: REQUEST OTP
─────────────────────
POST /auth/password-reset/request-otp
{
  "email": "user@example.com"
}

Response:
{
  "status": 200,
  "message": "OTP sent to your email. Please check your inbox.",
  "result": {
    "email": "user@example.com",
    "expiresIn": "10 minutes",
    "expiresAt": "2026-01-07T12:10:00.000Z"
  }
}

📧 User receives email with 6-digit OTP

─────────────────────

Step 2: VERIFY OTP
─────────────────────
POST /auth/password-reset/verify-otp
{
  "email": "user@example.com",
  "otp": "123456"
}

Response:
{
  "status": 200,
  "message": "OTP verified successfully. You can now reset your password.",
  "result": {
    "email": "user@example.com",
    "verified": true,
    "userType": "admin"
  }
}

─────────────────────

Step 3: RESET PASSWORD
─────────────────────
POST /auth/password-reset/reset
{
  "email": "user@example.com",
  "password": "NewSecurePass123!"
}

Response:
{
  "status": 200,
  "message": "Password reset successful. You can now login with your new password.",
  "result": {
    "email": "user@example.com"
  }
}

✅ Password updated successfully
```

---

## 📡 API Endpoints

### Admin Users

| Step | Endpoint | Method | Auth Required |
|------|----------|--------|---------------|
| 1 | `/auth/password-reset/request-otp` | POST | ❌ No |
| 2 | `/auth/password-reset/verify-otp` | POST | ❌ No |
| 3 | `/auth/password-reset/reset` | POST | ❌ No |

### Tenant Users

| Step | Endpoint | Method | Auth Required |
|------|----------|--------|---------------|
| 1 | `/t/auth/password-reset/request-otp` | POST | ❌ No |
| 2 | `/t/auth/password-reset/verify-otp` | POST | ❌ No |
| 3 | `/t/auth/password-reset/reset` | POST | ❌ No |

---

## 📝 Request/Response Examples

### 1. Request OTP (Admin)

**Request:**
```http
POST /auth/password-reset/request-otp
Content-Type: application/json

{
  "email": "admin@example.com"
}
```

**Response (Success):**
```json
{
  "status": 200,
  "message": "OTP sent to your email. Please check your inbox.",
  "result": {
    "email": "admin@example.com",
    "expiresIn": "10 minutes",
    "expiresAt": "2026-01-07T12:10:00.000Z"
  }
}
```

**Response (Rate Limited):**
```json
{
  "status": 429,
  "message": "Too many requests. Please try again in 15 minutes."
}
```

---

### 2. Verify OTP (Admin)

**Request:**
```http
POST /auth/password-reset/verify-otp
Content-Type: application/json

{
  "email": "admin@example.com",
  "otp": "123456"
}
```

**Response (Success):**
```json
{
  "status": 200,
  "message": "OTP verified successfully. You can now reset your password.",
  "result": {
    "email": "admin@example.com",
    "verified": true,
    "userType": "admin",
    "tenantSlug": null
  }
}
```

**Response (Invalid OTP):**
```json
{
  "status": 400,
  "message": "Invalid OTP. 4 attempt(s) remaining."
}
```

**Response (Max Attempts Exceeded):**
```json
{
  "status": 400,
  "message": "Maximum verification attempts exceeded. Please request a new OTP."
}
```

---

### 3. Reset Password (Admin)

**Request:**
```http
POST /auth/password-reset/reset
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "NewSecurePass123!"
}
```

**Response (Success):**
```json
{
  "status": 200,
  "message": "Password reset successful. You can now login with your new password.",
  "result": {
    "email": "admin@example.com"
  }
}
```

**Response (No Verified OTP):**
```json
{
  "status": 400,
  "message": "No verified OTP found. Please request and verify an OTP first."
}
```

---

## 🔐 Security Features

### 1. Rate Limiting
- **3 requests per 15 minutes** per email
- Prevents spam and abuse
- Implemented at service level

### 2. OTP Hashing
- OTP is **bcrypt hashed** before storage
- Never stored in plain text
- Secure comparison during verification

### 3. Attempt Limiting
- **5 verification attempts** maximum
- After 5 failed attempts, OTP is invalidated
- User must request a new OTP

### 4. Time-Based Expiry
- OTP expires in **10 minutes**
- Automatic cleanup via MongoDB TTL index
- Cannot be used after expiry

### 5. One-Time Use
- OTP is marked as `usedForReset: true` after password reset
- Cannot be reused for multiple password resets
- Prevents replay attacks

### 6. User Enumeration Protection
- Generic success message for non-existent users
- Doesn't reveal if email exists in system
- Security best practice

---

## 🎨 Email Template

The OTP email includes:

✅ **Professional branding** - Tritech logo and colors  
✅ **Large OTP display** - Easy to read 6-digit code  
✅ **Expiry warning** - Clear 10-minute countdown  
✅ **Attempt limit notice** - 5 attempts warning  
✅ **Security notice** - What to do if not requested  
✅ **Responsive design** - Works on all devices  

**Sample Email:**

```
┌────────────────────────────────────────┐
│         🔐 PASSWORD RESET              │
├────────────────────────────────────────┤
│                                        │
│  Hello,                                │
│                                        │
│  You requested to reset your password  │
│  for your Admin account.               │
│                                        │
│  Your verification code is:            │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │         1 2 3 4 5 6              │ │
│  └──────────────────────────────────┘ │
│                                        │
│  ⏰ This code expires in 10 minutes    │
│  🔒 You have 5 attempts                │
│                                        │
│  ⚠️ If you didn't request this,        │
│     please ignore this email.          │
│                                        │
│  — The Tritech Team                    │
└────────────────────────────────────────┘
```

---

## 🧪 Testing Guide

### Using Postman

1. **Import Collection:**
   - Import `postman/Password_Reset_OTP.postman_collection.json`
   - Set `base_url` variable (e.g., `http://localhost:3000`)

2. **Test Admin Flow:**
   - Run "1. Request OTP (Admin)"
   - Check email for OTP code
   - Set `otp_code` variable in Postman
   - Run "2. Verify OTP (Admin)"
   - Run "3. Reset Password (Admin)"

3. **Test Tenant Flow:**
   - Run "1. Request OTP (Tenant)"
   - Check email for OTP code
   - Set `otp_code` variable in Postman
   - Run "2. Verify OTP (Tenant)"
   - Run "3. Reset Password (Tenant)"

4. **Test Error Scenarios:**
   - Run "Rate Limit Exceeded" (request OTP 4 times)
   - Run "Invalid OTP" (wrong code)
   - Run "No Verified OTP" (skip verification step)

### Manual Testing

```bash
# 1. Request OTP for admin
curl -X POST http://localhost:3000/auth/password-reset/request-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com"}'

# 2. Verify OTP
curl -X POST http://localhost:3000/auth/password-reset/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "otp": "123456"}'

# 3. Reset password
curl -X POST http://localhost:3000/auth/password-reset/reset \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "NewSecurePass123!"}'
```

---

## 🚨 Error Handling

| Error Code | Message | Cause | Solution |
|------------|---------|-------|----------|
| 400 | Invalid OTP | Wrong OTP code | Check email for correct code |
| 400 | Maximum verification attempts exceeded | 5 failed attempts | Request a new OTP |
| 400 | No valid OTP found | OTP expired or not requested | Request a new OTP |
| 400 | No verified OTP found | Trying to reset without verifying | Verify OTP first |
| 404 | User not found | Email doesn't exist | Check email spelling |
| 429 | Too many requests | Rate limit exceeded | Wait 15 minutes |

---

## 📊 Monitoring & Logging

### Log Events

```javascript
// OTP requested
logger.info(`OTP requested for ${userType} user: ${email}`);

// OTP verified
logger.info(`OTP verified for ${userType} user: ${email}`);

// Password reset successful
logger.info(`${userType} password reset successful for: ${email}`);

// Email failed to send
logger.error('Failed to send OTP email:', emailError);
```

### Metrics to Monitor

- **OTP Request Rate** - Track requests per email
- **Verification Success Rate** - % of successful verifications
- **Failed Attempts** - Track invalid OTP attempts
- **Email Delivery Rate** - % of successful email sends
- **Time to Complete** - Average time from request to reset

---

## 🔧 Configuration

### Environment Variables

```bash
# Email Configuration (already configured)
EMAIL_SERVICE=gmail
EMAIL_USER=notifications.vmeals@gmail.com
EMAIL_PASS=scirxseibfucmbyt

# JWT Configuration (already configured)
JWT_SECRET_KEY=your-secret-key
JWT_TTL_DAYS=7
```

### OTP Service Constants

Located in `features/auth/services/OTPService.js`:

```javascript
const OTP_LENGTH = 6;                    // 6-digit OTP
const OTP_EXPIRY_MINUTES = 10;           // 10 minutes expiry
const MAX_ATTEMPTS = 5;                  // 5 verification attempts
const RATE_LIMIT_REQUESTS = 3;           // 3 requests per window
const RATE_LIMIT_WINDOW_MINUTES = 15;    // 15-minute window
```

---

## 🗂️ File Structure

```
features/
├── auth/
│   ├── model/
│   │   └── PasswordResetOTP.model.js       # OTP schema (Main DB)
│   ├── repository/
│   │   └── passwordResetOTP.repository.js  # OTP CRUD operations
│   ├── services/
│   │   ├── OTPService.js                   # OTP generation & validation
│   │   └── AuthService.js                  # Admin password reset methods
│   ├── controller/
│   │   └── AuthController.js               # Admin OTP endpoints
│   └── validation/
│       └── auth.validation.js              # Joi schemas
│
├── tenant-auth/
│   ├── services/
│   │   └── TenantAuthService.js            # Tenant password reset methods
│   ├── controller/
│   │   └── TenantAuthController.js         # Tenant OTP endpoints
│   └── validation/
│       └── tenantAuth.validation.js        # Joi schemas
│
docs/
└── PASSWORD_RESET_OTP.md                   # This document

postman/
└── Password_Reset_OTP.postman_collection.json  # API collection

middlewares/
└── Base.js                                 # Public route configuration
```

---

## 🎯 Use Cases

### Use Case 1: Admin Forgot Password

**Scenario:** Superadmin forgot their password and needs to reset it.

**Steps:**
1. Admin goes to login page
2. Clicks "Forgot Password"
3. Enters email: `admin@example.com`
4. Receives OTP via email: `123456`
5. Enters OTP on verification page
6. OTP verified successfully
7. Enters new password: `NewSecurePass123!`
8. Password reset successful
9. Logs in with new password

---

### Use Case 2: Tenant User Forgot Password

**Scenario:** Restaurant manager forgot their password.

**Steps:**
1. Manager goes to tenant login page
2. Clicks "Forgot Password"
3. Enters email: `manager@restaurant.com`
4. System resolves tenant from email domain: `restaurant`
5. Receives OTP via email: `654321`
6. Enters OTP on verification page
7. OTP verified successfully
8. Enters new password: `NewSecurePass123!`
9. Password reset successful
10. Logs in with new password

---

### Use Case 3: Rate Limiting Protection

**Scenario:** Attacker tries to spam OTP requests.

**Steps:**
1. Attacker requests OTP for `victim@example.com` (Request 1) ✅
2. Attacker requests OTP again (Request 2) ✅
3. Attacker requests OTP again (Request 3) ✅
4. Attacker requests OTP again (Request 4) ❌ **Rate Limited**
5. System returns: "Too many requests. Please try again in 15 minutes."
6. Attacker must wait 15 minutes before trying again

---

## 🆚 Comparison: Token vs OTP

| Feature | Old (Token-based) | New (OTP-based) |
|---------|-------------------|-----------------|
| **User Experience** | Click email link | Enter 6-digit code |
| **Security** | Token in URL (can be logged) | OTP not in URL |
| **Expiry** | 60 minutes | 10 minutes |
| **Attempts** | Unlimited | 5 attempts max |
| **Rate Limiting** | None | 3 requests / 15 min |
| **Mobile Friendly** | Requires email client | Copy-paste code |
| **Phishing Risk** | Higher (clickable link) | Lower (manual entry) |
| **Production Ready** | ⚠️ Basic | ✅ Enterprise-grade |

---

## 🚀 Deployment Checklist

- [ ] Verify email service is configured
- [ ] Test OTP email delivery in production
- [ ] Confirm MongoDB TTL index is created
- [ ] Test rate limiting behavior
- [ ] Verify tenant resolution from email domain
- [ ] Test all error scenarios
- [ ] Update frontend to use new OTP flow
- [ ] Document API for frontend team
- [ ] Set up monitoring for OTP metrics
- [ ] Test on mobile devices

---

## 🤝 Support

For questions or issues:

1. Check this documentation
2. Review Postman collection examples
3. Check application logs
4. Contact backend team

---

## 📚 Related Documentation

- [JWT Tenant Resolution](./JWT-TENANT-RESOLUTION.md)
- [Cashier Authentication](./CASHIER-AUTHENTICATION-ARCHITECTURE.md)
- [Branch POS Configuration](./BRANCH_POS_CONFIGURATION.md)

---

**Last Updated:** January 7, 2026  
**Version:** 1.0.0  
**Author:** Tritech Backend Team

