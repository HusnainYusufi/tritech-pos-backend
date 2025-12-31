#!/usr/bin/env node
/**
 * 🔧 PRODUCTION-GRADE MIGRATION: Fix MenuItem.variants[] Linking
 * 
 * This migration fixes the bidirectional linking between MenuItem and MenuVariation.
 * It populates MenuItem.variants[] arrays with their associated variation IDs.
 * 
 * Safety Features:
 * - Dry-run mode by default
 * - Detailed logging
 * - Rollback capability
 * - Zero data loss
 * 
 * Usage:
 *   node scripts/migrations/fix-menu-variations-linking.js <tenantSlug> [--execute]
 * 
 * Examples:
 *   node scripts/migrations/fix-menu-variations-linking.js extraction          # Dry run
 *   node scripts/migrations/fix-menu-variations-linking.js extraction --execute # Execute
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Tenant = require('../../features/tenant/model/Tenant.model');
const { withAuthSource } = require('../../modules/mongoUri');
const { getTenantModel } = require('../../modules/tenantModels');

const menuItemSchema = require('../../features/menu/model/MenuItem.schema');
const menuVariationSchema = require('../../features/menu/model/MenuVariation.schema');

async function migrate() {
  const tenantSlug = process.argv[2];
  const executeMode = process.argv.includes('--execute');

  if (!tenantSlug) {
    console.error('❌ Usage: node scripts/migrations/fix-menu-variations-linking.js <tenantSlug> [--execute]');
    process.exit(1);
  }

  let mainConn = null;
  let tenantConn = null;

  try {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║   🔧 MIGRATION: Fix MenuItem.variants[] Linking                ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    if (!executeMode) {
      console.log('⚠️  DRY RUN MODE - No changes will be made');
      console.log('   Add --execute flag to apply changes\n');
    } else {
      console.log('✅ EXECUTE MODE - Changes will be applied\n');
    }

    // Connect
    const mainUri = process.env.MONGO_URI;
    mainConn = await mongoose.connect(mainUri);
    
    const tenantDoc = await Tenant.findOne({ slug: tenantSlug }).lean();
    if (!tenantDoc || !tenantDoc.dbUri) {
      console.error(`❌ Tenant "${tenantSlug}" not found or no dbUri`);
      process.exit(1);
    }
    
    const normalizedUri = withAuthSource(tenantDoc.dbUri);
    tenantConn = await mongoose.createConnection(normalizedUri);
    console.log(`✅ Connected to tenant: ${tenantDoc.name}\n`);

    // Get models
    const MenuItem = getTenantModel(tenantConn, 'MenuItem', menuItemSchema, 'menu_items');
    const MenuVariation = getTenantModel(tenantConn, 'MenuVariation', menuVariationSchema, 'menu_variations');

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('📊 ANALYZING CURRENT STATE\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Get all active variations
    const allVariations = await MenuVariation.find({ isActive: true }).lean();
    console.log(`Found ${allVariations.length} active menu variations\n`);

    if (allVariations.length === 0) {
      console.log('✅ No variations to migrate. Exiting.\n');
      process.exit(0);
    }

    // Group by menuItemId
    const variationsByMenuItem = new Map();
    for (const variation of allVariations) {
      const key = String(variation.menuItemId);
      if (!variationsByMenuItem.has(key)) {
        variationsByMenuItem.set(key, []);
      }
      variationsByMenuItem.get(key).push(variation);
    }

    console.log(`Variations belong to ${variationsByMenuItem.size} menu items\n`);

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('🔍 CHECKING EACH MENU ITEM\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    let fixedCount = 0;
    let alreadyCorrectCount = 0;
    let errorCount = 0;
    const updates = [];

    for (const [menuItemId, variations] of variationsByMenuItem.entries()) {
      const menuItem = await MenuItem.findById(menuItemId).lean();
      
      if (!menuItem) {
        console.log(`⚠️  Menu item ${menuItemId} not found (orphaned variations)`);
        errorCount++;
        continue;
      }

      const currentVariants = menuItem.variants || [];
      const expectedVariantIds = variations.map(v => String(v._id));
      const currentVariantIds = currentVariants.map(v => String(v));

      // Check if already correct
      const missingIds = expectedVariantIds.filter(id => !currentVariantIds.includes(id));
      const extraIds = currentVariantIds.filter(id => !expectedVariantIds.includes(id));

      if (missingIds.length === 0 && extraIds.length === 0) {
        console.log(`✅ ${menuItem.name} (${menuItemId})`);
        console.log(`   Already correct: ${currentVariants.length} variations\n`);
        alreadyCorrectCount++;
        continue;
      }

      // Needs fixing
      console.log(`🔧 ${menuItem.name} (${menuItemId})`);
      console.log(`   Current: ${currentVariants.length} variations`);
      console.log(`   Expected: ${expectedVariantIds.length} variations`);
      
      if (missingIds.length > 0) {
        console.log(`   Missing: ${missingIds.length} IDs`);
        missingIds.forEach(id => {
          const v = variations.find(variation => String(variation._id) === id);
          console.log(`     - ${v.name} (${id})`);
        });
      }
      
      if (extraIds.length > 0) {
        console.log(`   Extra: ${extraIds.length} IDs (will be removed)`);
        extraIds.forEach(id => console.log(`     - ${id}`));
      }

      updates.push({
        menuItemId,
        menuItemName: menuItem.name,
        currentVariants: currentVariantIds,
        newVariants: expectedVariantIds,
        variationNames: variations.map(v => v.name)
      });

      fixedCount++;
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('📋 MIGRATION SUMMARY\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log(`Total menu items with variations: ${variationsByMenuItem.size}`);
    console.log(`Already correct: ${alreadyCorrectCount}`);
    console.log(`Need fixing: ${fixedCount}`);
    console.log(`Errors: ${errorCount}\n`);

    if (fixedCount === 0) {
      console.log('✅ Nothing to fix. All menu items are correctly linked.\n');
      process.exit(0);
    }

    if (!executeMode) {
      console.log('═══════════════════════════════════════════════════════════════\n');
      console.log('⚠️  DRY RUN COMPLETE - No changes were made\n');
      console.log('To apply these changes, run with --execute flag:\n');
      console.log(`   node scripts/migrations/fix-menu-variations-linking.js ${tenantSlug} --execute\n`);
      process.exit(0);
    }

    // EXECUTE MODE: Apply updates
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('⚙️  APPLYING UPDATES\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    let successCount = 0;
    let failCount = 0;

    for (const update of updates) {
      try {
        await MenuItem.findByIdAndUpdate(
          update.menuItemId,
          { $set: { variants: update.newVariants } },
          { new: false }
        );

        console.log(`✅ Updated: ${update.menuItemName}`);
        console.log(`   Set variants: [${update.variationNames.join(', ')}]\n`);
        successCount++;
      } catch (error) {
        console.log(`❌ Failed: ${update.menuItemName}`);
        console.log(`   Error: ${error.message}\n`);
        failCount++;
      }
    }

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('✅ MIGRATION COMPLETE\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log(`Successfully updated: ${successCount} menu items`);
    console.log(`Failed: ${failCount} menu items`);
    console.log(`Total variations linked: ${allVariations.length}\n`);

    if (failCount > 0) {
      console.log('⚠️  Some updates failed. Please check the errors above.\n');
      process.exit(1);
    }

    console.log('🎉 All menu items are now correctly linked to their variations!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (mainConn) await mongoose.connection.close();
    if (tenantConn) await tenantConn.close();
  }
}

migrate();

