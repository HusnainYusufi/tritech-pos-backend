# Password Reset with OTP - Quick Start Guide

## 🚀 5-Minute Setup

### For Admin Users

```bash
# 1. Request OTP
POST http://localhost:3000/auth/password-reset/request-otp
{
  "email": "admin@example.com"
}

# 2. Check email for 6-digit OTP (e.g., 123456)

# 3. Verify OTP
POST http://localhost:3000/auth/password-reset/verify-otp
{
  "email": "admin@example.com",
  "otp": "123456"
}

# 4. Reset Password
POST http://localhost:3000/auth/password-reset/reset
{
  "email": "admin@example.com",
  "password": "NewSecurePass123!"
}

# 5. Login with new password
POST http://localhost:3000/auth/login
{
  "email": "admin@example.com",
  "password": "NewSecurePass123!"
}
```

---

### For Tenant Users

```bash
# 1. Request OTP
POST http://localhost:3000/t/auth/password-reset/request-otp
{
  "email": "user@restaurant.com"
}

# 2. Check email for 6-digit OTP (e.g., 654321)

# 3. Verify OTP
POST http://localhost:3000/t/auth/password-reset/verify-otp
{
  "email": "user@restaurant.com",
  "otp": "654321"
}

# 4. Reset Password
POST http://localhost:3000/t/auth/password-reset/reset
{
  "email": "user@restaurant.com",
  "password": "NewSecurePass123!"
}

# 5. Login with new password
POST http://localhost:3000/t/auth/login
{
  "email": "user@restaurant.com",
  "password": "NewSecurePass123!"
}
```

---

## 📋 Key Points

✅ **No authentication required** - All endpoints are public  
✅ **No tenant header required** - Tenant resolved from email domain  
✅ **3-step process** - Request → Verify → Reset  
✅ **10-minute expiry** - OTP valid for 10 minutes  
✅ **5 attempts** - Maximum 5 verification attempts  
✅ **Rate limited** - 3 requests per 15 minutes per email  

---

## 🎯 Frontend Integration

### Step 1: Forgot Password Screen

```javascript
// User enters email
const requestOTP = async (email) => {
  const response = await fetch('/auth/password-reset/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  
  const data = await response.json();
  
  if (data.status === 200) {
    // Show success message
    alert('OTP sent to your email. Please check your inbox.');
    // Navigate to OTP verification screen
    navigateToOTPScreen(email);
  } else {
    alert(data.message);
  }
};
```

### Step 2: OTP Verification Screen

```javascript
// User enters 6-digit OTP
const verifyOTP = async (email, otp) => {
  const response = await fetch('/auth/password-reset/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp })
  });
  
  const data = await response.json();
  
  if (data.status === 200) {
    // OTP verified successfully
    alert('OTP verified! You can now reset your password.');
    // Navigate to password reset screen
    navigateToPasswordResetScreen(email);
  } else {
    // Show error (e.g., "Invalid OTP. 4 attempt(s) remaining.")
    alert(data.message);
  }
};
```

### Step 3: Password Reset Screen

```javascript
// User enters new password
const resetPassword = async (email, password) => {
  const response = await fetch('/auth/password-reset/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  
  if (data.status === 200) {
    // Password reset successful
    alert('Password reset successful! You can now login.');
    // Navigate to login screen
    navigateToLogin();
  } else {
    alert(data.message);
  }
};
```

---

## 🧪 Testing with Postman

1. **Import Collection:**
   ```
   File → Import → postman/Password_Reset_OTP.postman_collection.json
   ```

2. **Set Variables:**
   - `base_url`: `http://localhost:3000`
   - `admin_email`: Your admin email
   - `tenant_email`: Your tenant email

3. **Run Flow:**
   - Execute "1. Request OTP (Admin)"
   - Check email for OTP code
   - Set `otp_code` variable
   - Execute "2. Verify OTP (Admin)"
   - Execute "3. Reset Password (Admin)"

---

## ⚠️ Common Issues

### Issue: "Too many requests"
**Solution:** Wait 15 minutes before requesting OTP again.

### Issue: "Invalid OTP"
**Solution:** Double-check the OTP code from your email. Case-sensitive.

### Issue: "No verified OTP found"
**Solution:** You must verify the OTP before resetting password.

### Issue: "Maximum verification attempts exceeded"
**Solution:** Request a new OTP.

---

## 📧 Email Configuration

Email service is already configured:

```javascript
// modules/nodemail.js
service: 'gmail',
user: 'notifications.vmeals@gmail.com',
pass: 'scirxseibfucmbyt'
```

No additional configuration needed!

---

## 🎨 UI/UX Recommendations

### Forgot Password Screen
- Single input field for email
- Clear "Send OTP" button
- Show loading state while sending
- Display success message with countdown

### OTP Verification Screen
- 6 separate input boxes for digits (better UX)
- Auto-focus next box on digit entry
- Show remaining attempts
- "Resend OTP" button (disabled for 60 seconds)
- Countdown timer showing expiry

### Password Reset Screen
- Password input with strength indicator
- Confirm password field
- Show password requirements
- Clear "Reset Password" button

---

## 📊 Response Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Proceed to next step |
| 400 | Bad Request | Show error message to user |
| 404 | Not Found | User doesn't exist |
| 429 | Rate Limited | Show "Try again in X minutes" |

---

## 🔗 Related Endpoints

### Admin
- Request: `POST /auth/password-reset/request-otp`
- Verify: `POST /auth/password-reset/verify-otp`
- Reset: `POST /auth/password-reset/reset`

### Tenant
- Request: `POST /t/auth/password-reset/request-otp`
- Verify: `POST /t/auth/password-reset/verify-otp`
- Reset: `POST /t/auth/password-reset/reset`

---

## ✅ Checklist

- [ ] Test OTP request for admin user
- [ ] Test OTP request for tenant user
- [ ] Verify email delivery
- [ ] Test OTP verification
- [ ] Test password reset
- [ ] Test rate limiting (4th request)
- [ ] Test invalid OTP (5 attempts)
- [ ] Test expired OTP (after 10 minutes)
- [ ] Test login with new password

---

**Ready to use!** 🎉

For detailed documentation, see [PASSWORD_RESET_OTP.md](./PASSWORD_RESET_OTP.md)

