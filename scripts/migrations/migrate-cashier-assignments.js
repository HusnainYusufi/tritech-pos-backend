// scripts/migrations/migrate-cashier-assignments.js
/**
 * Migration Script: Assign Cashiers to Primary Branch
 * 
 * This script migrates existing cashier accounts to use the new assignedBranchId field.
 * 
 * Strategy:
 * 1. Find all staff users (isStaff: true) with a PIN
 * 2. If they have exactly 1 branch in branchIds, set that as assignedBranchId
 * 3. If they have multiple branches, log a warning (manual intervention needed)
 * 4. If they have no branches, log an error (manual intervention needed)
 * 
 * Usage:
 *   node scripts/migrations/migrate-cashier-assignments.js <tenant-slug>
 *   node scripts/migrations/migrate-cashier-assignments.js --all (migrate all tenants)
 *   node scripts/migrations/migrate-cashier-assignments.js <tenant-slug> --dry-run (preview changes)
 */

'use strict';

const mongoose = require('mongoose');
const { getTenantConnection } = require('../../modules/connectionManager');
const TenantRepo = require('../../features/tenant/repository/tenant.repository');
const TenantUserRepo = require('../../features/tenant-auth/repository/tenantUser.repository');
const logger = require('../../modules/logger');

async function migrateTenant(tenantSlug, dryRun = false) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📦 Processing Tenant: ${tenantSlug}`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    const conn = await getTenantConnection(tenantSlug);
    const User = TenantUserRepo.model(conn);

    // Find all staff users with PIN
    const staffUsers = await User.find({
      isStaff: true,
      pinHash: { $ne: null }
    }).lean();

    console.log(`Found ${staffUsers.length} staff members with PIN\n`);

    let migrated = 0;
    let skipped = 0;
    let warnings = 0;
    let errors = 0;

    for (const user of staffUsers) {
      const branchIds = user.branchIds || [];
      const email = user.email;
      const fullName = user.fullName;

      // Skip if already has assignedBranchId
      if (user.assignedBranchId) {
        console.log(`⏭️  SKIP: ${fullName} (${email}) - Already has assignedBranchId`);
        skipped++;
        continue;
      }

      // Case 1: Single branch - auto-assign
      if (branchIds.length === 1) {
        console.log(`✅ MIGRATE: ${fullName} (${email})`);
        console.log(`   Branch: ${branchIds[0]}`);
        
        if (!dryRun) {
          await User.updateOne(
            { _id: user._id },
            { $set: { assignedBranchId: branchIds[0] } }
          );
        }
        migrated++;
        continue;
      }

      // Case 2: Multiple branches - needs manual intervention
      if (branchIds.length > 1) {
        console.log(`⚠️  WARNING: ${fullName} (${email})`);
        console.log(`   Has ${branchIds.length} branches: ${branchIds.join(', ')}`);
        console.log(`   ➡️  Manual intervention required: Choose primary branch`);
        warnings++;
        continue;
      }

      // Case 3: No branches - error
      console.log(`❌ ERROR: ${fullName} (${email})`);
      console.log(`   No branches assigned!`);
      console.log(`   ➡️  Manual intervention required: Assign a branch`);
      errors++;
    }

    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📊 Summary for ${tenantSlug}:`);
    console.log(`   ✅ Migrated:  ${migrated}`);
    console.log(`   ⏭️  Skipped:   ${skipped}`);
    console.log(`   ⚠️  Warnings:  ${warnings} (multiple branches - needs manual assignment)`);
    console.log(`   ❌ Errors:    ${errors} (no branches - needs manual assignment)`);
    console.log(`${'─'.repeat(80)}\n`);

    return { migrated, skipped, warnings, errors };

  } catch (error) {
    console.error(`❌ Error processing tenant ${tenantSlug}:`, error.message);
    throw error;
  }
}

async function migrateAllTenants(dryRun = false) {
  console.log('\n🌍 Migrating ALL tenants...\n');
  
  const tenants = await TenantRepo.getAll();
  console.log(`Found ${tenants.length} tenants\n`);

  const totals = { migrated: 0, skipped: 0, warnings: 0, errors: 0 };

  for (const tenant of tenants) {
    try {
      const result = await migrateTenant(tenant.slug, dryRun);
      totals.migrated += result.migrated;
      totals.skipped += result.skipped;
      totals.warnings += result.warnings;
      totals.errors += result.errors;
    } catch (error) {
      console.error(`Failed to migrate tenant ${tenant.slug}:`, error.message);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 GRAND TOTAL (All Tenants):`);
  console.log(`   ✅ Migrated:  ${totals.migrated}`);
  console.log(`   ⏭️  Skipped:   ${totals.skipped}`);
  console.log(`   ⚠️  Warnings:  ${totals.warnings} (multiple branches - needs manual assignment)`);
  console.log(`   ❌ Errors:    ${totals.errors} (no branches - needs manual assignment)`);
  console.log(`${'='.repeat(80)}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Usage: node migrate-cashier-assignments.js <tenant-slug> [--dry-run]');
    console.error('   or:    node migrate-cashier-assignments.js --all [--dry-run]');
    process.exit(1);
  }

  const dryRun = args.includes('--dry-run');
  const migrateAll = args.includes('--all');
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  try {
    if (migrateAll) {
      await migrateAllTenants(dryRun);
    } else {
      const tenantSlug = args[0];
      await migrateTenant(tenantSlug, dryRun);
    }

    console.log('✅ Migration completed successfully!\n');
    
    if (dryRun) {
      console.log('💡 Run without --dry-run to apply changes\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { migrateTenant, migrateAllTenants };

