#!/usr/bin/env node
/**
 * Tenant Connection Diagnostic Tool
 * 
 * Usage: node scripts/test-tenant-connection.js <tenant-slug>
 * 
 * This script helps diagnose tenant connection issues by:
 * 1. Checking if tenant exists in main DB
 * 2. Validating the dbUri format
 * 3. Testing the connection to tenant DB
 * 4. Verifying tenant data can be queried
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Tenant = require('../features/tenant/model/Tenant.model');
const { withAuthSource } = require('../modules/mongoUri');
const logger = require('../modules/logger');

const tenantSlug = process.argv[2];

if (!tenantSlug) {
  console.error('❌ Usage: node scripts/test-tenant-connection.js <tenant-slug>');
  process.exit(1);
}

async function testTenantConnection() {
  let mainConn = null;
  let tenantConn = null;

  try {
    console.log('\n🔍 Tenant Connection Diagnostic Tool');
    console.log('=====================================\n');

    // Step 1: Connect to main DB
    console.log('📡 Step 1: Connecting to main database...');
    const mainUri = process.env.MONGO_URI || 'mongodb://localhost:27017/tritech_main';
    console.log(`   URI: ${mainUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')}`);
    
    mainConn = await mongoose.connect(mainUri);
    console.log('   ✅ Main database connected\n');

    // Step 2: Find tenant
    console.log(`📋 Step 2: Looking up tenant "${tenantSlug}"...`);
    const tenantDoc = await Tenant.findOne({ slug: tenantSlug }).lean();
    
    if (!tenantDoc) {
      console.error(`   ❌ Tenant "${tenantSlug}" not found in database`);
      console.log('\n💡 Available tenants:');
      const allTenants = await Tenant.find({}).select('slug name status').lean();
      if (allTenants.length === 0) {
        console.log('   (No tenants found)');
      } else {
        allTenants.forEach(t => {
          console.log(`   - ${t.slug} (${t.name}) [${t.status}]`);
        });
      }
      process.exit(1);
    }

    console.log('   ✅ Tenant found');
    console.log(`   Name: ${tenantDoc.name}`);
    console.log(`   Status: ${tenantDoc.status}`);
    console.log(`   Plan ID: ${tenantDoc.planId || 'N/A'}`);
    console.log(`   Created: ${tenantDoc.registrationDate || 'N/A'}\n`);

    // Step 3: Validate dbUri
    console.log('🔗 Step 3: Validating tenant dbUri...');
    if (!tenantDoc.dbUri) {
      console.error('   ❌ Tenant has no dbUri field!');
      console.log('   This tenant needs a dbUri to be set.');
      process.exit(1);
    }

    console.log(`   Original URI: ${tenantDoc.dbUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')}`);
    
    // Check URI format
    if (!tenantDoc.dbUri.startsWith('mongodb://') && !tenantDoc.dbUri.startsWith('mongodb+srv://')) {
      console.error('   ❌ Invalid MongoDB URI format!');
      console.log('   URI must start with "mongodb://" or "mongodb+srv://"');
      process.exit(1);
    }

    const normalizedUri = withAuthSource(tenantDoc.dbUri);
    console.log(`   Normalized URI: ${normalizedUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')}`);
    console.log('   ✅ URI format is valid\n');

    // Step 4: Test connection
    console.log('🔌 Step 4: Testing connection to tenant database...');
    tenantConn = await mongoose.createConnection(normalizedUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('   ✅ Connection established');
    console.log(`   Database name: ${tenantConn.name}`);
    console.log(`   Ready state: ${tenantConn.readyState} (1 = connected)\n`);

    // Step 5: Test querying
    console.log('📊 Step 5: Testing database queries...');
    const collections = await tenantConn.db.listCollections().toArray();
    console.log(`   ✅ Found ${collections.length} collections:`);
    collections.forEach(col => {
      console.log(`      - ${col.name}`);
    });

    console.log('\n✅ All tests passed! Tenant connection is working correctly.\n');

  } catch (error) {
    console.error('\n❌ Error occurred:', error.message);
    console.error('\n📋 Error details:');
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Cleanup
    if (mainConn) {
      await mongoose.connection.close();
      console.log('🔒 Main database connection closed');
    }
    if (tenantConn) {
      await tenantConn.close();
      console.log('🔒 Tenant database connection closed');
    }
    process.exit(0);
  }
}

testTenantConnection();

