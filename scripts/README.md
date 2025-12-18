# Utility Scripts

This directory contains utility scripts for managing and debugging the Tritech POS system.

## Tenant Management Scripts

### 1. Test Tenant Connection

Tests if a tenant's database connection is working correctly.

```bash
node scripts/test-tenant-connection.js <tenant-slug>
```

**Example:**
```bash
node scripts/test-tenant-connection.js extraction-testt
```

**What it checks:**
- ✅ Tenant exists in main database
- ✅ Tenant has valid dbUri
- ✅ dbUri format is correct (mongodb:// or mongodb+srv://)
- ✅ Connection to tenant database works
- ✅ Can query tenant database

### 2. Fix Tenant dbUri

Fixes or regenerates a tenant's database URI.

```bash
node scripts/fix-tenant-dburi.js <tenant-slug> [--force]
```

**Example:**
```bash
# Add dbUri if missing
node scripts/fix-tenant-dburi.js extraction-testt

# Force regenerate even if dbUri exists
node scripts/fix-tenant-dburi.js extraction-testt --force
```

**Use cases:**
- Tenant has no dbUri field
- dbUri is malformed or incorrect
- Need to regenerate dbUri with new format

## Troubleshooting

### Issue: "Tenant not found"

**Solution:**
1. Check tenant exists: Connect to MongoDB and verify the tenant in the main database
2. Check slug spelling: Ensure you're using the correct tenant slug (case-insensitive)

### Issue: "Invalid MongoDB URI format"

**Solution:**
1. Run the fix script: `node scripts/fix-tenant-dburi.js <slug> --force`
2. Verify environment variables are set correctly (MONGO_URI, MONGO_URI_MAIN)

### Issue: "Connection failed"

**Possible causes:**
- MongoDB server is not running
- Incorrect credentials in environment variables
- Network/firewall issues
- Database doesn't exist yet

**Solution:**
1. Check MongoDB is running: `mongosh` or check service status
2. Verify environment variables in `.env`
3. Check MongoDB logs for authentication errors

## Environment Variables Required

These scripts require the following environment variables:

```bash
MONGO_URI=mongodb://username:password@host:port/database
MONGO_URI_MAIN=mongodb://username:password@host:port/database
MONGO_AUTH_DB=admin  # Optional, defaults to 'admin'
```

## Making Scripts Executable (Unix/Linux/Mac)

```bash
chmod +x scripts/*.js
```

Then you can run them directly:
```bash
./scripts/test-tenant-connection.js extraction-testt
```

