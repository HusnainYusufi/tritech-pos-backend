#!/usr/bin/env node
/**
 * Tenant dbUri Fix Tool
 * 
 * Usage: node scripts/fix-tenant-dburi.js <tenant-slug>
 * 
 * This script fixes tenant dbUri issues by:
 * 1. Checking if tenant exists
 * 2. Validating or regenerating the dbUri
 * 3. Updating the tenant record with correct dbUri
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Tenant = require('../features/tenant/model/Tenant.model');
const { buildTenantDbUri } = require('../modules/mongoUri');

const tenantSlug = process.argv[2];
const forceUpdate = process.argv.includes('--force');

if (!tenantSlug) {
  console.error('❌ Usage: node scripts/fix-tenant-dburi.js <tenant-slug> [--force]');
  console.error('   --force: Update dbUri even if it already exists');
  process.exit(1);
}

async function fixTenantDbUri() {
  try {
    console.log('\n🔧 Tenant dbUri Fix Tool');
    console.log('=========================\n');

    // Connect to main DB
    console.log('📡 Connecting to main database...');
    const mainUri = process.env.MONGO_URI || 'mongodb://localhost:27017/tritech_main';
    await mongoose.connect(mainUri);
    console.log('✅ Connected\n');

    // Find tenant
    console.log(`📋 Looking up tenant "${tenantSlug}"...`);
    const tenantDoc = await Tenant.findOne({ slug: tenantSlug });
    
    if (!tenantDoc) {
      console.error(`❌ Tenant "${tenantSlug}" not found`);
      process.exit(1);
    }

    console.log('✅ Tenant found');
    console.log(`   Name: ${tenantDoc.name}`);
    console.log(`   Current dbUri: ${tenantDoc.dbUri || '(none)'}\n`);

    // Check if update needed
    if (tenantDoc.dbUri && !forceUpdate) {
      console.log('ℹ️  Tenant already has a dbUri.');
      console.log('   Use --force flag to regenerate it.');
      process.exit(0);
    }

    // Generate new dbUri
    console.log('🔨 Generating new dbUri...');
    const newDbUri = buildTenantDbUri(tenantSlug);
    console.log(`   New URI: ${newDbUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')}\n`);

    // Update tenant
    console.log('💾 Updating tenant record...');
    tenantDoc.dbUri = newDbUri;
    await tenantDoc.save();
    console.log('✅ Tenant updated successfully\n');

    console.log('✅ Done! You can now test the connection with:');
    console.log(`   node scripts/test-tenant-connection.js ${tenantSlug}\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

fixTenantDbUri();

