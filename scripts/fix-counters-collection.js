#!/usr/bin/env node
/**
 * Fix __counters collection duplicate key error
 * 
 * This script fixes the issue where documents with key: null exist in __counters collection
 * causing duplicate key errors.
 * 
 * Usage:
 *   node scripts/fix-counters-collection.js <tenant-slug>
 * 
 * What it does:
 * 1. Connects to the tenant database
 * 2. Drops the existing key_1 index if it's not sparse
 * 3. Recreates the index as sparse (allows multiple nulls)
 * 4. Optionally removes documents with key: null that don't have a valid _id pattern
 */

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const Tenant = require('../features/tenant/model/Tenant.model');
const { getTenantConnection } = require('../modules/connectionManager');

async function fixCountersCollection(tenantSlug) {
  if (!tenantSlug) {
    console.error('❌ Error: tenant-slug is required');
    console.log('Usage: node scripts/fix-counters-collection.js <tenant-slug>');
    process.exit(1);
  }

  try {
    console.log(`\n🔧 Fixing __counters collection for tenant: ${tenantSlug}\n`);

    // 1. Get tenant from main DB
    const tenant = await Tenant.findOne({ slug: tenantSlug }).lean();
    if (!tenant) {
      console.error(`❌ Tenant "${tenantSlug}" not found`);
      process.exit(1);
    }

    if (!tenant.dbUri) {
      console.error(`❌ Tenant "${tenantSlug}" has no dbUri`);
      process.exit(1);
    }

    // 2. Connect to tenant DB
    console.log('📡 Connecting to tenant database...');
    const conn = await getTenantConnection(tenantSlug, tenant.dbUri);
    console.log('✅ Connected\n');

    // 3. Get the __counters collection
    const collection = conn.db.collection('__counters');
    
    // 4. Check current indexes
    console.log('📊 Checking current indexes...');
    const indexes = await collection.indexes();
    const keyIndex = indexes.find(idx => idx.name === 'key_1');
    
    if (keyIndex) {
      console.log(`   Found key_1 index: ${JSON.stringify(keyIndex)}`);
      
      // Check if it's sparse
      if (!keyIndex.sparse) {
        console.log('   ⚠️  Index is not sparse, will recreate as sparse...');
        
        // Drop the existing index
        console.log('   🗑️  Dropping existing key_1 index...');
        await collection.dropIndex('key_1');
        console.log('   ✅ Index dropped');
        
        // Recreate as sparse
        console.log('   🔨 Creating sparse key_1 index...');
        await collection.createIndex({ key: 1 }, { unique: true, sparse: true });
        console.log('   ✅ Sparse index created');
      } else {
        console.log('   ✅ Index is already sparse');
      }
    } else {
      console.log('   ℹ️  No key_1 index found, creating sparse index...');
      await collection.createIndex({ key: 1 }, { unique: true, sparse: true });
      console.log('   ✅ Sparse index created');
    }

    // 5. Check for documents with key: null
    console.log('\n🔍 Checking for problematic documents...');
    const nullKeyDocs = await collection.find({ key: null }).toArray();
    const invalidKeyDocs = await collection.find({ key: { $exists: false } }).toArray();
    
    console.log(`   Found ${nullKeyDocs.length} documents with key: null`);
    console.log(`   Found ${invalidKeyDocs.length} documents without key field`);

    // 6. Clean up documents with key: null that don't have valid _id pattern
    if (nullKeyDocs.length > 0 || invalidKeyDocs.length > 0) {
      console.log('\n🧹 Cleaning up invalid documents...');
      
      // Documents with _id starting with "sku:" are valid (from sku.js module)
      // Documents with key field are valid (from sequence.js module)
      // Documents with key: null and no valid _id pattern should be removed
      
      const allDocs = [...nullKeyDocs, ...invalidKeyDocs];
      let removed = 0;
      
      for (const doc of allDocs) {
        const hasValidId = doc._id && String(doc._id).startsWith('sku:');
        const hasValidKey = doc.key && doc.key !== null;
        
        // If it has neither valid _id pattern nor valid key, it's orphaned
        if (!hasValidId && !hasValidKey) {
          console.log(`   🗑️  Removing orphaned document: _id=${doc._id}, key=${doc.key}`);
          await collection.deleteOne({ _id: doc._id });
          removed++;
        } else {
          console.log(`   ✅ Keeping valid document: _id=${doc._id}, key=${doc.key}`);
        }
      }
      
      console.log(`\n   ✅ Removed ${removed} orphaned documents`);
    }

    // 7. Summary
    console.log('\n📈 Final status:');
    const totalDocs = await collection.countDocuments();
    const skuDocs = await collection.countDocuments({ _id: /^sku:/ });
    const keyDocs = await collection.countDocuments({ key: { $exists: true, $ne: null } });
    
    console.log(`   Total documents: ${totalDocs}`);
    console.log(`   SKU counter documents (_id starts with "sku:"): ${skuDocs}`);
    console.log(`   Sequence counter documents (has key field): ${keyDocs}`);
    
    console.log('\n✅ Fix completed successfully!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  const tenantSlug = process.argv[2];
  fixCountersCollection(tenantSlug)
    .then(() => {
      // Already handled in function
    })
    .catch((err) => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { fixCountersCollection };
