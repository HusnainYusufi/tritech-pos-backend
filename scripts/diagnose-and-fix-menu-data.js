#!/usr/bin/env node
/**
 * 🔍 DIAGNOSE & FIX: Menu Variations and Add-Ons
 * 
 * Checks why variations and add-ons are not showing in branch menu
 * and provides actionable fixes
 * 
 * Usage: node scripts/diagnose-and-fix-menu-data.js <tenant> <menuItemId>
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
const menuCategorySchema = require('../features/menu/model/MenuCategory.schema');

async function diagnose() {
  const tenantSlug = process.argv[2];
  const menuItemId = process.argv[3];

  if (!tenantSlug) {
    console.error('Usage: node scripts/diagnose-and-fix-menu-data.js <tenant> [menuItemId]');
    process.exit(1);
  }

  let mainConn, tenantConn;

  try {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  🔍 DIAGNOSE: Menu Variations & Add-Ons                  ║');
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
    const MenuCategory = getTenantModel(tenantConn, 'MenuCategory', menuCategorySchema, 'menu_categories');

    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📊 SYSTEM OVERVIEW\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    const [menuItemCount, variationCount, groupCount, itemCount, categoryCount] = await Promise.all([
      MenuItem.countDocuments({ isActive: true }),
      MenuVariation.countDocuments({ isActive: true }),
      AddOnGroup.countDocuments({ isActive: true }),
      AddOnItem.countDocuments({ isActive: true }),
      MenuCategory.countDocuments({ isActive: true })
    ]);

    console.log(`Menu Items (Active): ${menuItemCount}`);
    console.log(`Menu Variations (Active): ${variationCount}`);
    console.log(`Add-On Groups (Active): ${groupCount}`);
    console.log(`Add-On Items (Active): ${itemCount}`);
    console.log(`Categories (Active): ${categoryCount}\n`);

    if (menuItemId) {
      console.log('═══════════════════════════════════════════════════════════\n');
      console.log(`🔍 ANALYZING SPECIFIC ITEM: ${menuItemId}\n`);
      console.log('═══════════════════════════════════════════════════════════\n');

      const item = await MenuItem.findById(menuItemId).lean();
      if (!item) {
        console.log(`❌ Menu item not found: ${menuItemId}\n`);
        process.exit(1);
      }

      console.log(`📋 Item: ${item.name}`);
      console.log(`   Category ID: ${item.categoryId || 'NONE'}`);
      console.log(`   Recipe ID: ${item.recipeId || 'NONE'}`);
      console.log(`   Active: ${item.isActive}`);
      console.log(`   variants[] array: ${(item.variants || []).length} IDs\n`);

      // Check variations
      console.log('1️⃣  Checking Variations...');
      const variations = await MenuVariation.find({
        menuItemId: menuItemId,
        isActive: true
      }).lean();

      console.log(`   Found: ${variations.length} variations\n`);

      if (variations.length === 0) {
        console.log('   ❌ NO VARIATIONS EXIST FOR THIS ITEM\n');
        console.log('   To create variations, use:\n');
        console.log('   POST /t/menu-variations');
        console.log('   {');
        console.log(`     "menuItemId": "${menuItemId}",`);
        console.log('     "name": "Large",');
        console.log('     "type": "size",');
        console.log('     "priceDelta": 3.00');
        console.log('   }\n');
      } else {
        console.log('   ✅ Variations:');
        variations.forEach(v => {
          console.log(`   - ${v.name} (${v.type}) +${v.priceDelta || 0}`);
        });
        console.log('');

        // Check if MenuItem.variants[] is synced
        const variantIds = (item.variants || []).map(String);
        const actualIds = variations.map(v => String(v._id));
        const missing = actualIds.filter(id => !variantIds.includes(id));

        if (missing.length > 0) {
          console.log(`   ⚠️  MenuItem.variants[] is OUT OF SYNC!`);
          console.log(`   Missing ${missing.length} variation IDs in MenuItem.variants[]\n`);
          console.log(`   Run migration to fix:`);
          console.log(`   node scripts/migrations/sync-menu-item-variants.js ${tenantSlug} --execute\n`);
        } else {
          console.log(`   ✅ MenuItem.variants[] is properly synced\n`);
        }
      }

      // Check add-ons
      console.log('2️⃣  Checking Add-Ons (Category-Based)...');
      
      if (!item.categoryId) {
        console.log('   ❌ NO CATEGORY ASSIGNED TO THIS ITEM\n');
        console.log('   Add-ons are category-based. Assign a category first:\n');
        console.log('   PUT /t/menu/items/' + menuItemId);
        console.log('   {');
        console.log('     "categoryId": "<category_id>"');
        console.log('   }\n');
      } else {
        const category = await MenuCategory.findById(item.categoryId).lean();
        console.log(`   Category: ${category?.name || 'Unknown'} (${item.categoryId})\n`);

        const groups = await AddOnGroup.find({
          categoryId: item.categoryId,
          isActive: true
        }).lean();

        console.log(`   Found: ${groups.length} add-on groups for this category\n`);

        if (groups.length === 0) {
          console.log('   ❌ NO ADD-ON GROUPS FOR THIS CATEGORY\n');
          console.log('   To create add-on groups:\n');
          console.log('   POST /t/addons/groups');
          console.log('   {');
          console.log(`     "categoryId": "${item.categoryId}",`);
          console.log('     "name": "TOPPINGS",');
          console.log('     "description": "Extra toppings"');
          console.log('   }\n');
        } else {
          console.log('   ✅ Add-On Groups:');
          for (const group of groups) {
            const items = await AddOnItem.find({
              groupId: group._id,
              isActive: true
            }).lean();
            console.log(`   - ${group.name}: ${items.length} items`);
            items.forEach(item => {
              console.log(`     • ${item.nameSnapshot} (+${item.price || 0})`);
            });
          }
          console.log('');
        }
      }

    } else {
      // General overview
      console.log('═══════════════════════════════════════════════════════════\n');
      console.log('📊 GENERAL ANALYSIS\n');
      console.log('═══════════════════════════════════════════════════════════\n');

      // Check items with/without variations
      const itemsWithVariations = await MenuItem.aggregate([
        { $match: { isActive: true } },
        {
          $lookup: {
            from: 'menu_variations',
            localField: '_id',
            foreignField: 'menuItemId',
            as: 'variations'
          }
        },
        {
          $project: {
            name: 1,
            hasVariations: { $gt: [{ $size: '$variations' }, 0] }
          }
        }
      ]);

      const withVars = itemsWithVariations.filter(i => i.hasVariations).length;
      const withoutVars = itemsWithVariations.length - withVars;

      console.log(`Items WITH variations: ${withVars}`);
      console.log(`Items WITHOUT variations: ${withoutVars}\n`);

      // Check categories with/without add-ons
      const categories = await MenuCategory.find({ isActive: true }).lean();
      let catsWithAddOns = 0;
      let catsWithoutAddOns = 0;

      for (const cat of categories) {
        const groups = await AddOnGroup.countDocuments({
          categoryId: cat._id,
          isActive: true
        });
        if (groups > 0) catsWithAddOns++;
        else catsWithoutAddOns++;
      }

      console.log(`Categories WITH add-on groups: ${catsWithAddOns}`);
      console.log(`Categories WITHOUT add-on groups: ${catsWithoutAddOns}\n`);

      if (withoutVars > 0) {
        console.log(`⚠️  ${withoutVars} items have no variations`);
        console.log(`   This is OK if they don't need variations (e.g., simple items)\n`);
      }

      if (catsWithoutAddOns > 0) {
        console.log(`⚠️  ${catsWithoutAddOns} categories have no add-on groups`);
        console.log(`   Create add-on groups if needed\n`);
      }
    }

    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('✅ DIAGNOSIS COMPLETE\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (variationCount === 0 && groupCount === 0) {
      console.log('🔴 PROBLEM: No variations or add-ons exist in the system!\n');
      console.log('📝 ACTION REQUIRED:\n');
      console.log('1. Create menu variations for items that need them');
      console.log('2. Create add-on groups for categories');
      console.log('3. Create add-on items within groups\n');
      console.log('See documentation: docs/POS-MENU-VARIATIONS-ADDONS-COMPLETE.md\n');
    } else if (variationCount === 0) {
      console.log('⚠️  No variations exist. Create them if needed.\n');
    } else if (groupCount === 0) {
      console.log('⚠️  No add-on groups exist. Create them if needed.\n');
    } else {
      console.log('✅ System has variations and add-ons configured!\n');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    if (mainConn) await mongoose.connection.close();
    if (tenantConn) await tenantConn.close();
  }
}

diagnose();

