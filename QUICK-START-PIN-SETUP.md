# 🚀 Quick Start: Fix PIN Login in 5 Minutes

## The Problem
Your PIN login says "Invalid credentials" because `PIN_PEPPER` environment variable is not set on your server.

## The Solution (5 Steps)

### 1️⃣ SSH into Your Production Server
```bash
ssh user@your-server-ip
cd /var/www/tritech-pos-backend
```

### 2️⃣ Generate Secure Values
```bash
# Generate PIN_PEPPER
openssl rand -hex 32

# Copy the output, example:
# 87269de01a43a984e90f56da3fbe458914534f593affecfa65e90c6a228349f7

# Generate JWT_SECRET_KEY
openssl rand -hex 32

# Copy the output, example:
# 3f0edd0447d444fd8d57f5ba75a16a0f45a0c261ec4ae5ff20acceb1c72e73b5
```

### 3️⃣ Create .env File
```bash
# Create the file
nano .env

# Paste these lines (replace with YOUR generated values):
PIN_PEPPER=87269de01a43a984e90f56da3fbe458914534f593affecfa65e90c6a228349f7
JWT_SECRET_KEY=3f0edd0447d444fd8d57f5ba75a16a0f45a0c261ec4ae5ff20acceb1c72e73b5

# Save: Ctrl+X, then Y, then Enter

# Secure the file
chmod 600 .env
```

### 4️⃣ Restart Your Application
```bash
# Pull latest code
git pull origin main

# Restart with PM2
pm2 restart all

# Check it's running
pm2 logs --lines 20
```

### 5️⃣ Re-Set Staff PIN
```bash
# Call this API (replace with your values):
curl -X POST http://your-server/api/t/staff/695c19f328e0595f4d5992c1/set-pin \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: faraz" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"pin":"123456"}'

# Expected response:
# {
#   "status": 200,
#   "message": "PIN updated",
#   "result": { ... }
# }
```

### ✅ Test PIN Login
```bash
curl -X POST http://your-server/api/t/auth/login-pin \
  -H "Content-Type: application/json" \
  -d '{"pin":"123456"}'

# Should return JWT token! 🎉
```

---

## Visual Flow

```
┌─────────────────────────────────────────────────────────────┐
│  BEFORE (Not Working)                                       │
├─────────────────────────────────────────────────────────────┤
│  Server Environment:                                        │
│    ❌ PIN_PEPPER = not set (uses default 'pin-pepper')     │
│    ❌ JWT_SECRET_KEY = not set                             │
│                                                             │
│  Database:                                                  │
│    pinKey: 6e208a40... (created with unknown pepper)       │
│                                                             │
│  Login Attempt:                                             │
│    Computed pinKey: 6c50ab5b... (different!)               │
│    Result: ❌ "Invalid credentials"                        │
└─────────────────────────────────────────────────────────────┘

                            ⬇️  FIX  ⬇️

┌─────────────────────────────────────────────────────────────┐
│  AFTER (Working)                                            │
├─────────────────────────────────────────────────────────────┤
│  Server Environment:                                        │
│    ✅ PIN_PEPPER = 87269de01a43a984e90f56da3fbe458914...   │
│    ✅ JWT_SECRET_KEY = 3f0edd0447d444fd8d57f5ba75a16...    │
│                                                             │
│  Re-set PIN via API:                                        │
│    New pinKey: a1b2c3d4... (created with new pepper)       │
│                                                             │
│  Login Attempt:                                             │
│    Computed pinKey: a1b2c3d4... (matches!)                 │
│    Result: ✅ JWT token returned                           │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚠️ Important Notes

1. **Save Your Secrets**: Store `PIN_PEPPER` and `JWT_SECRET_KEY` in a password manager
2. **Never Change Them**: Once set in production, these values must remain constant
3. **Re-set All PINs**: Every staff member needs their PIN re-set after this fix
4. **Don't Commit .env**: The `.env` file should never be committed to git

---

## 🆘 Still Not Working?

Run the diagnostic tool:
```bash
node scripts/verify-pin-setup.js 123456 6e208a40e5867d2f630729bcb044e450710729c2fc81774098fc34be64eb71cd
```

Check the output:
- ✅ Green checkmarks = Good
- ❌ Red X = Problem found
- ⚠️ Yellow warning = Needs attention

For detailed help, see:
- `SETUP-ENVIRONMENT.md` - Complete setup guide
- `CRITICAL-FIX-PIN-LOGIN.md` - Full troubleshooting guide
- `DEBUG-PIN-LOGIN.md` - Debugging steps

