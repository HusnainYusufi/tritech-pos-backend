# Environment Setup Guide

## 🚨 Critical: PIN_PEPPER & JWT_SECRET_KEY

Your PIN login system requires these environment variables to be set **before** creating any staff PINs.

## Quick Setup (Production Server)

### Step 1: Generate Secure Values

On your production server, run:

```bash
# Generate PIN_PEPPER (32 bytes = 64 hex chars)
openssl rand -hex 32

# Generate JWT_SECRET_KEY (32 bytes = 64 hex chars)
openssl rand -hex 32
```

Example output:
```
87269de01a43a984e90f56da3fbe458914534f593affecfa65e90c6a228349f7
3f0edd0447d444fd8d57f5ba75a16a0f45a0c261ec4ae5ff20acceb1c72e73b5
```

### Step 2: Set Environment Variables

**Option A: Using .env file (Recommended)**

```bash
cd /var/www/tritech-pos-backend

# Create .env file
nano .env

# Add these lines (replace with your generated values):
PIN_PEPPER=87269de01a43a984e90f56da3fbe458914534f593affecfa65e90c6a228349f7
JWT_SECRET_KEY=3f0edd0447d444fd8d57f5ba75a16a0f45a0c261ec4ae5ff20acceb1c72e73b5
JWT_TTL_DAYS=7
PIN_BCRYPT_ROUNDS=12
PIN_LOGIN_MAX_ATTEMPTS=5
PIN_LOGIN_LOCK_MINUTES=15

# Save and exit (Ctrl+X, Y, Enter)

# Secure the file
chmod 600 .env
```

**Option B: Using PM2 ecosystem file**

```bash
cd /var/www/tritech-pos-backend

# Edit ecosystem.config.js
nano ecosystem.config.js
```

Add to the `env` section:

```javascript
module.exports = {
  apps: [{
    name: 'tritech-pos-backend',
    script: './app.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3004,
      PIN_PEPPER: '87269de01a43a984e90f56da3fbe458914534f593affecfa65e90c6a228349f7',
      JWT_SECRET_KEY: '3f0edd0447d444fd8d57f5ba75a16a0f45a0c261ec4ae5ff20acceb1c72e73b5',
      JWT_TTL_DAYS: 7,
      PIN_BCRYPT_ROUNDS: 12,
      PIN_LOGIN_MAX_ATTEMPTS: 5,
      PIN_LOGIN_LOCK_MINUTES: 15
    }
  }]
}
```

**Option C: Export in shell (Temporary - for testing only)**

```bash
export PIN_PEPPER="87269de01a43a984e90f56da3fbe458914534f593affecfa65e90c6a228349f7"
export JWT_SECRET_KEY="3f0edd0447d444fd8d57f5ba75a16a0f45a0c261ec4ae5ff20acceb1c72e73b5"
```

⚠️ **Warning**: This only lasts until the terminal session ends!

### Step 3: Restart Application

```bash
# If using PM2
pm2 restart all

# Or if using PM2 ecosystem file
pm2 delete all
pm2 start ecosystem.config.js

# Verify it's running
pm2 status
pm2 logs tritech-pos-backend --lines 20
```

### Step 4: Verify Environment Variables

```bash
# Check if variables are loaded
node scripts/verify-pin-setup.js 123456

# Expected output should show:
# PIN_PEPPER: ✅ set (length: 64)
# JWT_SECRET_KEY: ✅ set (length: 64)
```

### Step 5: Re-Set All Staff PINs

After setting the environment variables, you **MUST** re-set all existing staff PINs:

```bash
# For each staff member
curl -X POST http://your-server/api/t/staff/{staffId}/set-pin \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: faraz" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"pin":"123456"}'
```

### Step 6: Test PIN Login

```bash
curl -X POST http://your-server/api/t/auth/login-pin \
  -H "Content-Type: application/json" \
  -d '{"pin":"123456"}'

# Should return:
# {
#   "status": 200,
#   "message": "Login successful",
#   "result": {
#     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#     ...
#   }
# }
```

## 🔒 Security Best Practices

### 1. Never Commit Secrets to Git

```bash
# Ensure .env is in .gitignore
echo ".env" >> .gitignore
echo "ecosystem.config.js" >> .gitignore  # If it contains secrets

# Verify
git status  # .env should not appear
```

### 2. Store Secrets Securely

- **Development**: Use `.env` file (not committed)
- **Production**: Use environment variables or secrets manager
- **Backup**: Store in password manager (1Password, LastPass, etc.)

### 3. Never Change These Values in Production

⚠️ **CRITICAL**: Once you set `PIN_PEPPER` and `JWT_SECRET_KEY` in production:

- **DO NOT** change them unless absolutely necessary
- Changing `PIN_PEPPER` → All PINs will stop working
- Changing `JWT_SECRET_KEY` → All JWT tokens will be invalidated

If you must change them:
1. Schedule maintenance window
2. Notify all users
3. Change the values
4. Re-set all staff PINs
5. All users must re-login

### 4. Use Strong Random Values

✅ **Good**: `openssl rand -hex 32` (64 characters)  
❌ **Bad**: `pin-pepper`, `secret123`, `mypassword`

## 📋 Checklist

Before going live:

- [ ] Generated secure `PIN_PEPPER` value (64 chars)
- [ ] Generated secure `JWT_SECRET_KEY` value (64 chars)
- [ ] Added to `.env` file or PM2 ecosystem
- [ ] Secured `.env` file (`chmod 600 .env`)
- [ ] Added `.env` to `.gitignore`
- [ ] Restarted application with PM2
- [ ] Verified environment variables are loaded
- [ ] Re-set all staff PINs
- [ ] Tested PIN login successfully
- [ ] Stored secrets in secure backup location
- [ ] Documented who has access to production secrets

## 🆘 Troubleshooting

### "Invalid credentials" after setting environment variables

**Cause**: Old PINs were created with different `PIN_PEPPER`  
**Fix**: Re-set all staff PINs via API

### Environment variables not loading

**Cause**: PM2 not reading `.env` file  
**Fix**: Use PM2 ecosystem file or restart PM2 daemon

```bash
pm2 kill
pm2 start ecosystem.config.js
```

### Can't find .env file

**Cause**: File doesn't exist yet  
**Fix**: Copy from example

```bash
cp .env.example .env
nano .env  # Edit with your values
```

## 📞 Support

If you encounter issues:

1. Run diagnostic: `node scripts/verify-pin-setup.js 123456`
2. Check PM2 logs: `pm2 logs --lines 100`
3. Verify env vars: `pm2 env 0` (shows environment for app 0)
4. Review `CRITICAL-FIX-PIN-LOGIN.md` for detailed troubleshooting

## 🔗 Related Documentation

- `CRITICAL-FIX-PIN-LOGIN.md` - Complete PIN login fix guide
- `DEBUG-PIN-LOGIN.md` - Detailed debugging steps
- `scripts/verify-pin-setup.js` - Diagnostic tool
- `.env.example` - Example environment variables

