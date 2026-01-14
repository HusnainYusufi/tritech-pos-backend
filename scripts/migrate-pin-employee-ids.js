#!/usr/bin/env node
/**
 * Migration Script: Add Employee IDs to existing PIN records
 * 
 * This script:
 * 1. Finds all TenantPinDirectory records without employeeId
 * 2. Generates unique Employee IDs for each
 * 3. Updates both TenantPinDirectory (main DB) and TenantUser (tenant DB)
 * 
 * Usage: node scripts/migrate-pin-employee-ids.js
 * 
 * Safe to run multiple times - only updates records missing employeeId.
 */

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const TenantPinDirectory = require('../features/tenant-auth/model/TenantPinDirectory.model');
const Tenant = require('../features/tenant/model/Tenant.model');
const { getTenantConnection } = require('../modules/connectionManager');
const { getTenantModel } = require('../modules/tenantModels');
const TenantUserSchemaFactory = require('../features/tenant-auth/model/TenantUser.schema');

// Generate Employee ID (same logic as repository)
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const generateEmployeeId = () => {
  let id = 'EMP-';
  for (let i = 0; i < 6; i++) {
    id += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return id;
};

const usedIds = new Set();
const generateUniqueEmployeeId = async () => {
  for (let i = 0; i < 10; i++) {
    const empId = generateEmployeeId();
    if (usedIds.has(empId)) continue;
    const exists = await TenantPinDirectory.findOne({ employeeId: empId }).lean();
    if (!exists) {
      usedIds.add(empId);
      return empId;
    }
  }
  // Fallback
  const fallback = `EMP-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  usedIds.add(fallback);
  return fallback;
};

async function migrate() {
  console.log('🚀 Starting PIN Employee ID Migration...\n');

  // Connect to main DB
  const mainDbUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mainDbUri) {
    console.error('❌ MONGO_URI not set in environment');
    process.exit(1);
  }

  await mongoose.connect(mainDbUri);
  console.log('✅ Connected to main database\n');

  // Find all PIN directory records without employeeId
  const recordsToMigrate = await TenantPinDirectory.find({
    $or: [
      { employeeId: { $exists: false } },
      { employeeId: null },
      { employeeId: '' }
    ]
  }).lean();

  console.log(`📋 Found ${recordsToMigrate.length} records to migrate\n`);

  if (recordsToMigrate.length === 0) {
    console.log('✅ Nothing to migrate - all records have Employee IDs');
    await mongoose.disconnect();
    return;
  }

  // Cache tenant connections
  const tenantConns = new Map();
  const getTenantConn = async (slug) => {
    if (tenantConns.has(slug)) return tenantConns.get(slug);
    const tenant = await Tenant.findOne({ slug }).lean();
    if (!tenant || !tenant.dbUri) return null;
    const conn = await getTenantConnection(slug, tenant.dbUri);
    tenantConns.set(slug, conn);
    return conn;
  };

  let migrated = 0;
  let failed = 0;

  for (const record of recordsToMigrate) {
    try {
      const employeeId = await generateUniqueEmployeeId();
      
      // Update TenantPinDirectory
      await TenantPinDirectory.updateOne(
        { _id: record._id },
        { $set: { employeeId } }
      );

      // Update TenantUser in tenant DB
      const conn = await getTenantConn(record.tenantSlug);
      if (conn) {
        const TenantUser = getTenantModel(conn, 'TenantUser', TenantUserSchemaFactory, 'tenant_users');
        await TenantUser.updateOne(
          { _id: record.tenantUserId },
          { $set: { employeeId } }
        );
      }

      console.log(`  ✅ ${record.tenantSlug} - User ${record.tenantUserId} → ${employeeId}`);
      migrated++;
    } catch (err) {
      console.error(`  ❌ Failed for ${record._id}: ${err.message}`);
      failed++;
    }
  }

  console.log('\n────────────────────────────────');
  console.log(`✅ Migrated: ${migrated}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('────────────────────────────────\n');

  await mongoose.disconnect();
  console.log('🏁 Migration complete');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
