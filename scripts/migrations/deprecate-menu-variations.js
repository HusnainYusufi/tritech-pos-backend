#!/usr/bin/env node
'use strict';

/**
 * ============================================================================
 * MIGRATION: Deprecate MenuVariations - Use RecipeVariants Instead
 * ============================================================================
 * 
 * PURPOSE:
 * - Remove MenuVariation collection (deprecated in favor of RecipeVariant)
 * - Clean up MenuItem.variants[] field references
 * - Document the architectural change to Single Source of Truth
 * 
 * ARCHITECTURE CHANGE:
 * Before: MenuItem → MenuVariation (duplicated data)
 * After:  MenuItem → Recipe → RecipeVariant (single source of truth)
 * 
 * BENEFITS:
 * ✅ No data duplication
 * ✅ Inventory-accurate cost tracking
 * ✅ Simpler architecture
 * ✅ Easier maintenance
 * 
 * USAGE:
 *   node scripts/migrations/deprecate-menu-variations.js <tenant-slug> [--execute]
 * 
 * SAFETY:
 * - Dry-run mode by default (shows what would be deleted)
 * - Use --execute flag to actually delete data
 * - Creates backup before deletion
 * ============================================================================
 */

const mongoose = require('mongoose');
const logger = require('../../modules/logger');
const { getTenantConnection } = require('../../modules/connectionManager');
const TenantRepo = require('../../features/tenant/tenant.repository');
const { getTenantModel } = require('../../modules/tenantModels');
const menuItemSchema = require('../../features/menu/model/MenuItem.schema');
const menuVariationSchema = require('../../features/menu/model/MenuVariation.schema');

async function main() {
  const args = process.argv.slice(2);
  const tenantSlug = args[0];
  const executeFlag = args.includes('--execute');

  if (!tenantSlug) {
    console.error('❌ Usage: node scripts/migrations/deprecate-menu-variations.js <tenant-slug> [--execute]');
    process.exit(1);
  }

  try {
    // Connect to master DB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/tritech-pos-master');
    logger.info('✅ Connected to master database');

    // Get tenant
    const tenant = await TenantRepo.findBySlug(tenantSlug);
    if (!tenant) {
      throw new Error(`Tenant "${tenantSlug}" not found`);
    }

    if (!tenant.dbUri) {
      throw new Error(`dbUri required for "${tenantSlug}"`);
    }

    logger.info(`📋 Tenant: ${tenant.name} (${tenant.slug})`);

    // Connect to tenant DB
    const conn = await getTenantConnection(tenant.dbUri);
    logger.info('✅ Connected to tenant database');

    // Get models
    const MenuItem = getTenantModel(conn, 'MenuItem', menuItemSchema, 'menu_items');
    const MenuVariation = getTenantModel(conn, 'MenuVariation', menuVariationSchema, 'menu_variations');

    // ========================================================================
    // STEP 1: Audit current state
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 AUDIT: Current State');
    console.log('='.repeat(80));

    const menuItemCount = await MenuItem.countDocuments({});
    const menuVariationCount = await MenuVariation.countDocuments({});
    const menuItemsWithVariants = await MenuItem.countDocuments({ 
      variants: { $exists: true, $ne: [] } 
    });

    console.log(`\n📦 Menu Items: ${menuItemCount}`);
    console.log(`📦 Menu Variations: ${menuVariationCount}`);
    console.log(`📦 Menu Items with variants[] field: ${menuItemsWithVariants}`);

    if (menuVariationCount === 0 && menuItemsWithVariants === 0) {
      console.log('\n✅ No MenuVariation data found. Migration not needed.');
      process.exit(0);
    }

    // ========================================================================
    // STEP 2: Show sample data
    // ========================================================================
    if (menuVariationCount > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('📄 Sample MenuVariations (first 5)');
      console.log('='.repeat(80));

      const sampleVariations = await MenuVariation.find({})
        .limit(5)
        .populate('menuItemId', 'name')
        .lean();

      sampleVariations.forEach((v, idx) => {
        console.log(`\n${idx + 1}. ${v.name}`);
        console.log(`   Menu Item: ${v.menuItemId?.name || 'N/A'}`);
        console.log(`   Type: ${v.type || 'N/A'}`);
        console.log(`   Price Delta: ${v.priceDelta || 0}`);
        console.log(`   Recipe Variant ID: ${v.recipeVariantId || 'None'}`);
      });
    }

    // ========================================================================
    // STEP 3: Execute or Dry-run
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    if (executeFlag) {
      console.log('⚠️  EXECUTE MODE: Deleting data...');
    } else {
      console.log('🔍 DRY-RUN MODE: No data will be deleted');
      console.log('   Add --execute flag to actually delete data');
    }
    console.log('='.repeat(80));

    if (executeFlag) {
      // Backup before deletion
      console.log('\n📦 Creating backup...');
      const backup = await MenuVariation.find({}).lean();
      const backupPath = `./backups/menu-variations-${tenantSlug}-${Date.now()}.json`;
      
      const fs = require('fs');
      const path = require('path');
      const backupDir = path.dirname(backupPath);
      
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
      console.log(`✅ Backup saved to: ${backupPath}`);

      // Delete MenuVariation collection
      console.log('\n🗑️  Deleting MenuVariation collection...');
      const deleteResult = await MenuVariation.deleteMany({});
      console.log(`✅ Deleted ${deleteResult.deletedCount} MenuVariation documents`);

      // Remove variants[] field from MenuItem
      console.log('\n🗑️  Removing variants[] field from MenuItem...');
      const updateResult = await MenuItem.updateMany(
        { variants: { $exists: true } },
        { $unset: { variants: '' } }
      );
      console.log(`✅ Updated ${updateResult.modifiedCount} MenuItem documents`);

      console.log('\n✅ Migration completed successfully!');
    } else {
      console.log('\n📋 Actions that would be performed:');
      console.log(`   - Delete ${menuVariationCount} MenuVariation documents`);
      console.log(`   - Remove variants[] field from ${menuItemsWithVariants} MenuItem documents`);
      console.log(`   - Create backup file`);
    }

    // ========================================================================
    // STEP 4: Next Steps
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('📚 NEXT STEPS');
    console.log('='.repeat(80));
    console.log(`
1. ✅ Variations now come from RecipeVariant collection
2. ✅ Use /t/recipe-variations API to manage variations
3. ✅ POS Menu API automatically fetches from RecipeVariant
4. ✅ No code changes needed in frontend (same structure)

📖 API Endpoint Changed:
   OLD: POST /t/menu/variations
   NEW: POST /t/recipe-variations

📖 Example: Create variation
   POST /t/recipe-variations
   {
     "recipeId": "69559233db8b00f29463f1ac",
     "name": "Large",
     "type": "size",
     "sizeMultiplier": 1.5,
     "baseCostAdjustment": 0
   }

📖 POS Menu API (unchanged):
   GET /t/pos/menu?branchId=xxx
   
   Response includes variations from RecipeVariant automatically!
`);

    console.log('='.repeat(80));
    console.log('✅ Migration script completed');
    console.log('='.repeat(80));

  } catch (err) {
    logger.error('❌ Migration failed:', err);
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main();

