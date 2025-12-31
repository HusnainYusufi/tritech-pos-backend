#!/usr/bin/env node
/**
 * 🧪 TEST: Branch Menu Effective API - Variations & Add-Ons
 * 
 * Tests the complete flow and diagnoses why variations/add-ons might not show
 * 
 * Usage: node scripts/test-branch-menu-effective-api.js <tenant> <branchId>
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Tenant = require('../features/tenant/model/Tenant.model');
const { withAuthSource } = require('../modules/mongoUri');
const { getTenantModel } = require('../modules/tenantModels');

const menuItemSchema = require('../features/menu/model/MenuItem.schema');
const menuVariationSchema = require('../features/menu/model/MenuVariation.schema');
const addOnGroupSchema = require('../features/addons/model/AddOnGroup.schema');
const addOnItemSchema = require('../features/addons/model/AddOnItem.schema');
const branchMenuSchema = require('../features/branch-menu/model/BranchMenu.schema');
const menuCategorySchema = require('../features/menu/model/MenuCategory.schema');

async function test() {
  const tenantSlug = process.argv[2];
  const branchId = process.argv[3];

  if (!tenantSlug || !branchId) {
    console.error('Usage: node scripts/test-branch-menu-effective-api.js <tenant> <branchId>');
    process.exit(1);
  }

  let mainConn, tenantConn;

  try {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  🧪 TEST: Branch Menu Effective API                      ║');
    console.log('║  Variations & Add-Ons Diagnostic                         ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    mainConn = await mongoose.connect(process.env.MONGO_URI);
    const tenant = await Tenant.findOne({ slug: tenantSlug }).lean();
    if (!tenant?.dbUri) throw new Error(`Tenant ${tenantSlug} not found`);

    tenantConn = await mongoose.createConnection(withAuthSource(tenant.dbUri));
    console.log(`✅ Connected: ${tenant.name}\n`);

    const MenuItem = getTenantModel(tenantConn, 'MenuItem', menuItemSchema, 'menu_items');
    const MenuVariation = getTenantModel(tenantConn, 'MenuVariation', menuVariationSchema, 'menu_variations');
    const AddOnGroup = getTenantModel(tenantConn, 'AddOnGroup', addOnGroupSchema, 'addon_groups');
    const AddOnItem = getTenantModel(tenantConn, 'AddOnItem', addOnItemSchema, 'addon_items');
    const BranchMenu = getTenantModel(tenantConn, 'BranchMenu', branchMenuSchema, 'branch_menus');
    const MenuCategory = getTenantModel(tenantConn, 'MenuCategory', menuCategorySchema, 'menu_categories');

    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📊 STEP 1: Check Menu Items Assigned to Branch\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    const branchMenus = await BranchMenu.find({ 
      branchId,
      isAvailable: true,
      isVisibleInPOS: true
    }).lean();

    console.log(`Branch Menu Assignments: ${branchMenus.length}\n`);

    if (branchMenus.length === 0) {
      console.log('❌ NO ITEMS ASSIGNED TO BRANCH!\n');
      console.log('This is why /effective returns empty.\n');
      console.log('Fix: Assign menu items using POST /t/branch-menu\n');
      process.exit(1);
    }

    const assignedMenuItemIds = branchMenus.map(bm => bm.menuItemId);

    console.log('Sample assigned items:');
    branchMenus.slice(0, 5).forEach(bm => {
      console.log(`  - ${bm.menuItemNameSnapshot} (${bm.menuItemId})`);
    });
    console.log('');

    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📊 STEP 2: Check Variations for Assigned Items\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    const variations = await MenuVariation.find({
      menuItemId: { $in: assignedMenuItemIds },
      isActive: true
    }).lean();

    console.log(`Total Variations: ${variations.length}\n`);

    if (variations.length === 0) {
      console.log('⚠️  NO VARIATIONS FOUND!\n');
      console.log('Possible reasons:');
      console.log('  1. No variations created for these menu items');
      console.log('  2. All variations are inactive (isActive: false)\n');
      console.log('Fix: Create variations using POST /t/menu-variations\n');
    } else {
      console.log('✅ Variations found:');
      
      // Group by menu item
      const varsByItem = new Map();
      for (const v of variations) {
        const key = String(v.menuItemId);
        if (!varsByItem.has(key)) varsByItem.set(key, []);
        varsByItem.get(key).push(v);
      }

      console.log(`  Items with variations: ${varsByItem.size}\n`);
      
      for (const [itemId, vars] of Array.from(varsByItem.entries()).slice(0, 3)) {
        const item = await MenuItem.findById(itemId).lean();
        console.log(`  📦 ${item?.name || 'Unknown'} (${vars.length} variations):`);
        vars.forEach(v => {
          console.log(`     - ${v.name} (${v.type}) | priceDelta: ${v.priceDelta || 0}`);
        });
        console.log('');
      }

      // Check MenuItem.variants[] sync
      console.log('  🔍 Checking MenuItem.variants[] sync...');
      let synced = 0, unsynced = 0;
      
      for (const [itemId, vars] of varsByItem.entries()) {
        const item = await MenuItem.findById(itemId).lean();
        if (!item) continue;
        
        const itemVariantIds = (item.variants || []).map(String);
        const actualVariantIds = vars.map(v => String(v._id));
        
        const allSynced = actualVariantIds.every(id => itemVariantIds.includes(id));
        if (allSynced) {
          synced++;
        } else {
          unsynced++;
          console.log(`     ⚠️  ${item.name}: variants[] not synced`);
        }
      }
      
      console.log(`  Synced: ${synced}, Unsynced: ${unsynced}\n`);
      
      if (unsynced > 0) {
        console.log('  ⚠️  Run migration to fix: node scripts/migrations/sync-menu-item-variants.js ' + tenantSlug + ' --execute\n');
      }
    }

    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📊 STEP 3: Check Add-Ons for Categories\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Get categories of assigned items
    const menuItems = await MenuItem.find({
      _id: { $in: assignedMenuItemIds }
    }).lean();

    const categoryIds = [...new Set(
      menuItems
        .map(m => m.categoryId)
        .filter(Boolean)
        .map(String)
    )];

    console.log(`Categories in use: ${categoryIds.length}\n`);

    if (categoryIds.length === 0) {
      console.log('⚠️  NO CATEGORIES ASSIGNED TO MENU ITEMS!\n');
      console.log('Add-ons are category-based, so no add-ons will show.\n');
    } else {
      const categories = await MenuCategory.find({
        _id: { $in: categoryIds }
      }).lean();

      console.log('Categories:');
      categories.forEach(cat => {
        console.log(`  - ${cat.name} (${cat._id})`);
      });
      console.log('');

      const addOnGroups = await AddOnGroup.find({
        categoryId: { $in: categoryIds },
        isActive: true
      }).lean();

      console.log(`Add-On Groups: ${addOnGroups.length}\n`);

      if (addOnGroups.length === 0) {
        console.log('⚠️  NO ADD-ON GROUPS FOUND!\n');
        console.log('Possible reasons:');
        console.log('  1. No add-on groups created for these categories');
        console.log('  2. All groups are inactive (isActive: false)\n');
        console.log('Fix: Create add-on groups using POST /t/addons/groups\n');
      } else {
        console.log('✅ Add-On Groups found:\n');

        for (const group of addOnGroups.slice(0, 5)) {
          const items = await AddOnItem.find({
            groupId: group._id,
            isActive: true
          }).lean();

          const category = categories.find(c => String(c._id) === String(group.categoryId));
          
          console.log(`  📦 ${group.name} (Category: ${category?.name || 'Unknown'})`);
          console.log(`     Items: ${items.length}`);
          items.slice(0, 3).forEach(item => {
            console.log(`     - ${item.nameSnapshot} | Price: ${item.price || 0}`);
          });
          console.log('');
        }
      }
    }

    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📊 STEP 4: Simulate /effective API Response\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('Simulating what /effective API should return...\n');

    // Simulate the service logic
    const sampleItem = menuItems[0];
    if (sampleItem) {
      console.log(`Sample Item: ${sampleItem.name}\n`);

      const itemVariations = await MenuVariation.find({
        menuItemId: sampleItem._id,
        isActive: true
      }).lean();

      const itemCategory = sampleItem.categoryId;
      const itemAddOnGroups = await AddOnGroup.find({
        categoryId: itemCategory,
        isActive: true
      }).lean();

      const addOnGroupIds = itemAddOnGroups.map(g => g._id);
      const itemAddOnItems = await AddOnItem.find({
        groupId: { $in: addOnGroupIds },
        isActive: true
      }).lean();

      console.log('Expected in /effective response:');
      console.log(`  variations: ${itemVariations.length} items`);
      console.log(`  addOns: ${itemAddOnGroups.length} groups`);
      console.log(`  addOn items total: ${itemAddOnItems.length}\n`);

      if (itemVariations.length > 0) {
        console.log('  ✅ Variations will show!');
        itemVariations.forEach(v => {
          console.log(`     - ${v.name} (${v.type})`);
        });
        console.log('');
      } else {
        console.log('  ❌ No variations will show\n');
      }

      if (itemAddOnGroups.length > 0) {
        console.log('  ✅ Add-ons will show!');
        itemAddOnGroups.forEach(g => {
          const groupItems = itemAddOnItems.filter(i => String(i.groupId) === String(g._id));
          console.log(`     - ${g.name} (${groupItems.length} items)`);
        });
        console.log('');
      } else {
        console.log('  ❌ No add-ons will show\n');
      }
    }

    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📋 FINAL DIAGNOSIS\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    const issues = [];
    const fixes = [];

    if (branchMenus.length === 0) {
      issues.push('❌ No menu items assigned to branch');
      fixes.push('POST /t/branch-menu to assign items');
    }

    if (variations.length === 0) {
      issues.push('⚠️  No variations found');
      fixes.push('POST /t/menu-variations to create variations');
    }

    if (categoryIds.length === 0) {
      issues.push('⚠️  Menu items have no categories');
      fixes.push('Update menu items to assign categories');
    } else {
      const addOnGroups = await AddOnGroup.find({
        categoryId: { $in: categoryIds },
        isActive: true
      }).lean();

      if (addOnGroups.length === 0) {
        issues.push('⚠️  No add-on groups for categories');
        fixes.push('POST /t/addons/groups to create add-on groups');
      }
    }

    if (issues.length === 0) {
      console.log('✅ ALL CHECKS PASSED!\n');
      console.log('The /effective API should be returning variations and add-ons.\n');
      console.log('If it\'s not, check:');
      console.log('  1. API endpoint is correct: GET /t/branch-menu/effective?branchId=' + branchId);
      console.log('  2. Tenant context is set correctly');
      console.log('  3. Check server logs for errors\n');
    } else {
      console.log('Issues found:\n');
      issues.forEach(issue => console.log(`  ${issue}`));
      console.log('\nHow to fix:\n');
      fixes.forEach(fix => console.log(`  ✅ ${fix}`));
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('❌ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    if (mainConn) await mongoose.connection.close();
    if (tenantConn) await tenantConn.close();
  }
}

test();

