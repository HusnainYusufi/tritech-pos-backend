'use strict';

/**
 * Build MAIN-DB tenant user directory (email -> tenantSlug) for existing tenants/users.
 *
 * Why:
 * - /t/auth/login and /t/auth/forgot-password need to resolve tenant BEFORE connecting to tenant DB.
 * - We do this by looking up email in a main-DB directory collection.
 *
 * Usage:
 *   node scripts/migrations/build-tenant-user-directory.js
 *
 * Requirements:
 *   - MAIN_DB_URI set (whatever your app uses to connect main DB)
 *   - Tenants have dbUri configured
 */

const mongoose = require('mongoose');
require('dotenv').config();
const { withAuthSource } = require('../../modules/mongoUri');
const Tenant = require('../../features/tenant/model/Tenant.model');
const { getTenantConnection, clearTenantConnection } = require('../../modules/connectionManager');
const TenantUserRepo = require('../../features/tenant-auth/repository/tenantUser.repository');
const TenantUserDirectoryRepo = require('../../features/tenant-auth/repository/tenantUserDirectory.repository');

async function main() {
  const MAIN_DB_URI = process.env.MAIN_DB_URI || process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!MAIN_DB_URI) {
    throw new Error('Missing MAIN_DB_URI (or MONGO_URI/MONGODB_URI)');
  }

  await mongoose.connect(withAuthSource(MAIN_DB_URI));

  const tenants = await Tenant.find({ status: { $ne: 'deleted' } }).lean();
  console.log(`Found ${tenants.length} tenants`);

  let upserts = 0;
  for (const t of tenants) {
    if (!t?.slug || !t?.dbUri) continue;
    const slug = String(t.slug).toLowerCase().trim();
    console.log(`\n[${slug}] syncing users...`);

    const conn = await getTenantConnection(slug, t.dbUri);
    const User = TenantUserRepo.model(conn);
    const users = await User.find({ email: { $exists: true, $ne: null } }).select('_id email isStaff roles').lean();

    for (const u of users) {
      const userType = (u.roles || []).includes('owner') ? 'owner' : 'staff';
      const r = await TenantUserDirectoryRepo.upsertByEmail({
        email: u.email,
        tenantSlug: slug,
        tenantUserId: u._id,
        userType
      });
      if (r) upserts++;
    }

    // Optional: close cached tenant connection in scripts
    clearTenantConnection(slug);
  }

  console.log(`\nDone. Upserted ${upserts} directory records.`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});


