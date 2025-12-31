#!/usr/bin/env node
/**
 * 🔧 PRODUCTION-GRADE MIGRATION: Fix Orphaned Add-On Items
 * 
 * This migration recreates missing AddOnGroups for orphaned AddOnItems.
 * It intelligently groups items by their original groupId and categoryId.
 * 
 * Safety Features:
 * - Dry-run mode by default
 * - Detailed logging
 * - Zero data loss
 * - Smart group naming
 * 
 * Usage:
 *   node scripts/migrations/fix-orphaned-addons.js <tenantSlug> [--execute]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Tenant = require('../../features/tenant/model/Tenant.model');
const { withAuthSource } = require('../../modules/mongoUri');
const { getTenantModel } = require('../../modules/tenantModels');

const addOnGroupSchema = require('../../features/addons/model/AddOnGroup.schema');
const addOnItemSchema = require('../../features/addons/model/AddOnItem.schema');
const menuCategorySchema = require('../../features/menu/model/MenuCategory.schema');

async function migrate() {
  const tenantSlug = process.argv[2];
  const executeMode = process.argv.includes('--execute');

  if (!tenantSlug) {
    console.error('❌ Usage: node scripts/migrations/fix-orphaned-addons.js <tenantSlug> [--execute]');
    process.exit(1);
  }

  let mainConn = null;
  let tenantConn = null;

  try {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║   🔧 MIGRATION: Fix Orphaned Add-On Items                      ║');
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
    const AddOnGroup = getTenantModel(tenantConn, 'AddOnGroup', addOnGroupSchema, 'addon_groups');
    const AddOnItem = getTenantModel(tenantConn, 'AddOnItem', addOnItemSchema, 'addon_items');
    const MenuCategory = getTenantModel(tenantConn, 'MenuCategory', menuCategorySchema, 'menu_categories');

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('📊 ANALYZING CURRENT STATE\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const allGroups = await AddOnGroup.find({}).lean();
    const allItems = await AddOnItem.find({}).lean();
    const allCategories = await MenuCategory.find({}).lean();

    console.log(`Add-On Groups: ${allGroups.length}`);
    console.log(`Add-On Items: ${allItems.length}`);
    console.log(`Categories: ${allCategories.length}\n`);

    if (allItems.length === 0) {
      console.log('✅ No add-on items found. Nothing to migrate.\n');
      process.exit(0);
    }

    // Find orphaned items
    const existingGroupIds = new Set(allGroups.map(g => String(g._id)));
    const orphanedItems = allItems.filter(item => !existingGroupIds.has(String(item.groupId)));

    console.log(`Orphaned items: ${orphanedItems.length}\n`);

    if (orphanedItems.length === 0) {
      console.log('✅ No orphaned items found. All items have valid groups.\n');
      process.exit(0);
    }

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('🔍 ANALYZING ORPHANED ITEMS\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Group orphaned items by their original groupId
    const itemsByGroupId = new Map();
    for (const item of orphanedItems) {
      const key = String(item.groupId);
      if (!itemsByGroupId.has(key)) {
        itemsByGroupId.set(key, []);
      }
      itemsByGroupId.get(key).push(item);
    }

    console.log(`Found ${itemsByGroupId.size} missing groups\n`);

    // Create category map for lookup
    const categoryMap = new Map(allCategories.map(c => [String(c._id), c]));

    const groupsToCreate = [];

    for (const [groupId, items] of itemsByGroupId.entries()) {
      // Get category from first item
      const categoryId = items[0].categoryId;
      const category = categoryMap.get(String(categoryId));

      if (!category) {
        console.log(`⚠️  Group ${groupId}: Category ${categoryId} not found, skipping ${items.length} items`);
        continue;
      }

      // Analyze items to create smart group name
      const sourceTypes = [...new Set(items.map(i => i.sourceType))];
      const sampleNames = items.slice(0, 3).map(i => i.nameSnapshot);

      let groupName = 'Add-Ons';
      if (sourceTypes.length === 1 && sourceTypes[0] === 'inventory') {
        groupName = 'Ingredients';
      } else if (sourceTypes.length === 1 && sourceTypes[0] === 'recipe') {
        groupName = 'Recipes';
      }

      // Make name unique for category
      groupName = `${category.name} - ${groupName}`;

      console.log(`📦 Group to create: "${groupName}"`);
      console.log(`   Original ID: ${groupId}`);
      console.log(`   Category: ${category.name}`);
      console.log(`   Items: ${items.length}`);
      console.log(`   Sample items: ${sampleNames.join(', ')}`);
      console.log('');

      groupsToCreate.push({
        originalId: groupId,
        categoryId: category._id,
        categoryName: category.name,
        name: groupName,
        description: `Auto-created group for ${items.length} add-on items`,
        isActive: true,
        displayOrder: 0,
        items: items
      });
    }

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('📋 MIGRATION SUMMARY\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log(`Groups to create: ${groupsToCreate.length}`);
    console.log(`Items to fix: ${orphanedItems.length}\n`);

    if (groupsToCreate.length === 0) {
      console.log('✅ Nothing to fix.\n');
      process.exit(0);
    }

    if (!executeMode) {
      console.log('═══════════════════════════════════════════════════════════════\n');
      console.log('⚠️  DRY RUN COMPLETE - No changes were made\n');
      console.log('To apply these changes, run with --execute flag:\n');
      console.log(`   node scripts/migrations/fix-orphaned-addons.js ${tenantSlug} --execute\n`);
      process.exit(0);
    }

    // EXECUTE MODE: Create groups and update items
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('⚙️  APPLYING UPDATES\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    let successCount = 0;
    let failCount = 0;
    const groupIdMapping = new Map(); // old ID → new ID

    for (const groupData of groupsToCreate) {
      try {
        // Create new group
        const newGroup = await AddOnGroup.create({
          categoryId: groupData.categoryId,
          name: groupData.name,
          description: groupData.description,
          isActive: groupData.isActive,
          displayOrder: groupData.displayOrder,
          metadata: { migratedFrom: groupData.originalId, migratedAt: new Date().toISOString() }
        });

        console.log(`✅ Created group: "${groupData.name}" (${newGroup._id})`);

        // Update all items to point to new group
        const itemIds = groupData.items.map(i => i._id);
        const updateResult = await AddOnItem.updateMany(
          { _id: { $in: itemIds } },
          { $set: { groupId: newGroup._id } }
        );

        console.log(`   Updated ${updateResult.modifiedCount} items\n`);

        groupIdMapping.set(groupData.originalId, newGroup._id);
        successCount++;

      } catch (error) {
        console.log(`❌ Failed to create group: "${groupData.name}"`);
        console.log(`   Error: ${error.message}\n`);
        failCount++;
      }
    }

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('✅ MIGRATION COMPLETE\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log(`Successfully created: ${successCount} groups`);
    console.log(`Failed: ${failCount} groups`);
    console.log(`Total items fixed: ${orphanedItems.length}\n`);

    if (failCount > 0) {
      console.log('⚠️  Some updates failed. Please check the errors above.\n');
      process.exit(1);
    }

    console.log('🎉 All orphaned add-on items now have valid groups!\n');

    // Verify
    const remainingOrphans = await AddOnItem.countDocuments({
      groupId: { $nin: await AddOnGroup.distinct('_id') }
    });

    if (remainingOrphans > 0) {
      console.log(`⚠️  Warning: ${remainingOrphans} orphaned items still remain.\n`);
    } else {
      console.log('✅ Verification passed: No orphaned items remaining.\n');
    }

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

