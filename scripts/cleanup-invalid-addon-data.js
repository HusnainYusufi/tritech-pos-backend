#!/usr/bin/env node
/**
 * 🧹 PRODUCTION-GRADE CLEANUP: Remove Invalid Add-On Data
 * 
 * This script removes add-on items that reference non-existent categories.
 * This is safer than trying to recreate groups for invalid data.
 * 
 * Usage:
 *   node scripts/cleanup-invalid-addon-data.js <tenantSlug> [--execute]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Tenant = require('../features/tenant/model/Tenant.model');
const { withAuthSource } = require('../modules/mongoUri');
const { getTenantModel } = require('../modules/tenantModels');

const addOnItemSchema = require('../features/addons/model/AddOnItem.schema');
const menuCategorySchema = require('../features/menu/model/MenuCategory.schema');

async function cleanup() {
  const tenantSlug = process.argv[2];
  const executeMode = process.argv.includes('--execute');

  if (!tenantSlug) {
    console.error('❌ Usage: node scripts/cleanup-invalid-addon-data.js <tenantSlug> [--execute]');
    process.exit(1);
  }

  let mainConn = null;
  let tenantConn = null;

  try {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║   🧹 CLEANUP: Remove Invalid Add-On Data                       ║');
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
    const AddOnItem = getTenantModel(tenantConn, 'AddOnItem', addOnItemSchema, 'addon_items');
    const MenuCategory = getTenantModel(tenantConn, 'MenuCategory', menuCategorySchema, 'menu_categories');

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('📊 ANALYZING DATA\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const allItems = await AddOnItem.find({}).lean();
    const allCategories = await MenuCategory.find({}).lean();

    console.log(`Add-On Items: ${allItems.length}`);
    console.log(`Categories: ${allCategories.length}\n`);

    if (allItems.length === 0) {
      console.log('✅ No add-on items found.\n');
      process.exit(0);
    }

    // Find items with invalid categories
    const validCategoryIds = new Set(allCategories.map(c => String(c._id)));
    const invalidItems = allItems.filter(item => !validCategoryIds.has(String(item.categoryId)));

    console.log(`Items with invalid categories: ${invalidItems.length}\n`);

    if (invalidItems.length === 0) {
      console.log('✅ All add-on items have valid categories.\n');
      process.exit(0);
    }

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('🗑️  ITEMS TO DELETE\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Group by category for display
    const itemsByCategory = new Map();
    for (const item of invalidItems) {
      const key = String(item.categoryId);
      if (!itemsByCategory.has(key)) {
        itemsByCategory.set(key, []);
      }
      itemsByCategory.get(key).push(item);
    }

    for (const [categoryId, items] of itemsByCategory.entries()) {
      console.log(`❌ Category ${categoryId} (not found)`);
      console.log(`   Items: ${items.length}`);
      items.slice(0, 5).forEach(item => {
        console.log(`   - ${item.nameSnapshot} (${item._id})`);
      });
      if (items.length > 5) {
        console.log(`   ... and ${items.length - 5} more`);
      }
      console.log('');
    }

    if (!executeMode) {
      console.log('═══════════════════════════════════════════════════════════════\n');
      console.log('⚠️  DRY RUN COMPLETE - No changes were made\n');
      console.log('To delete these items, run with --execute flag:\n');
      console.log(`   node scripts/cleanup-invalid-addon-data.js ${tenantSlug} --execute\n`);
      console.log('⚠️  WARNING: This will permanently delete these items!\n');
      process.exit(0);
    }

    // EXECUTE MODE: Delete invalid items
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('⚙️  DELETING INVALID ITEMS\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const itemIds = invalidItems.map(i => i._id);
    const deleteResult = await AddOnItem.deleteMany({ _id: { $in: itemIds } });

    console.log(`✅ Deleted ${deleteResult.deletedCount} invalid add-on items\n`);

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('✅ CLEANUP COMPLETE\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const remainingItems = await AddOnItem.countDocuments({});
    console.log(`Remaining add-on items: ${remainingItems}\n`);

    console.log('🎉 Database cleaned! All remaining add-on items have valid categories.\n');

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (mainConn) await mongoose.connection.close();
    if (tenantConn) await tenantConn.close();
  }
}

cleanup();

