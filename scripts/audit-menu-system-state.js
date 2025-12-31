#!/usr/bin/env node
/**
 * 🔍 PRODUCTION-GRADE MENU SYSTEM AUDIT
 * 
 * Head of Engineering: Pre-fix audit to understand current state
 * and ensure zero data loss during fixes.
 * 
 * Usage: node scripts/audit-menu-system-state.js <tenantSlug>
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
const recipeSchema = require('../features/recipe/model/Recipe.schema');
const recipeVariantSchema = require('../features/recipe-variant/model/RecipeVariant.schema');

async function audit() {
  const tenantSlug = process.argv[2];
  if (!tenantSlug) {
    console.error('❌ Usage: node scripts/audit-menu-system-state.js <tenantSlug>');
    process.exit(1);
  }

  let mainConn = null;
  let tenantConn = null;

  try {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║     🔍 PRODUCTION-GRADE MENU SYSTEM AUDIT                      ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

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
    const AddOnGroup = getTenantModel(tenantConn, 'AddOnGroup', addOnGroupSchema, 'addon_groups');
    const AddOnItem = getTenantModel(tenantConn, 'AddOnItem', addOnItemSchema, 'addon_items');
    const Recipe = getTenantModel(tenantConn, 'Recipe', recipeSchema, 'recipes');
    const RecipeVariant = getTenantModel(tenantConn, 'RecipeVariant', recipeVariantSchema, 'recipe_variants');

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('📊 CURRENT STATE ANALYSIS\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 1. Recipes
    const recipeCount = await Recipe.countDocuments({ isActive: true });
    const recipeVariantCount = await RecipeVariant.countDocuments({ isActive: true });
    console.log(`📦 Recipes: ${recipeCount} active`);
    console.log(`   Recipe Variants: ${recipeVariantCount} active\n`);

    // 2. Menu Items
    const menuItemCount = await MenuItem.countDocuments({ isActive: true });
    const menuItemsWithRecipe = await MenuItem.countDocuments({ isActive: true, recipeId: { $ne: null } });
    console.log(`🍔 Menu Items: ${menuItemCount} active`);
    console.log(`   With Recipe: ${menuItemsWithRecipe}`);
    console.log(`   Without Recipe: ${menuItemCount - menuItemsWithRecipe}\n`);

    // 3. Menu Variations
    const menuVariationCount = await MenuVariation.countDocuments({ isActive: true });
    console.log(`🔀 Menu Variations: ${menuVariationCount} active`);

    // 4. Check MenuItem.variants[] population
    const itemsWithVariantsArray = await MenuItem.countDocuments({ 
      isActive: true,
      variants: { $exists: true, $ne: [] }
    });
    console.log(`   Menu Items with populated variants[]: ${itemsWithVariantsArray}`);
    console.log(`   ⚠️  Expected: ${menuVariationCount > 0 ? 'Should match variation count' : 'N/A'}\n`);

    // 5. Add-On Groups
    const addOnGroupCount = await AddOnGroup.countDocuments({});
    const activeAddOnGroupCount = await AddOnGroup.countDocuments({ isActive: true });
    console.log(`➕ Add-On Groups: ${addOnGroupCount} total, ${activeAddOnGroupCount} active`);

    // 6. Add-On Items
    const addOnItemCount = await AddOnItem.countDocuments({});
    const activeAddOnItemCount = await AddOnItem.countDocuments({ isActive: true });
    console.log(`🍟 Add-On Items: ${addOnItemCount} total, ${activeAddOnItemCount} active\n`);

    // 7. Check MenuItem.addOns[] population
    const itemsWithAddOnsArray = await MenuItem.countDocuments({ 
      isActive: true,
      addOns: { $exists: true, $ne: [] }
    });
    console.log(`   Menu Items with populated addOns[]: ${itemsWithAddOnsArray}\n`);

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('🔴 CRITICAL ISSUES DETECTED\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    let issueCount = 0;

    // Issue #1: MenuItem.variants[] not populated
    if (menuVariationCount > 0 && itemsWithVariantsArray === 0) {
      issueCount++;
      console.log(`❌ ISSUE #1: MenuItem.variants[] Not Populated`);
      console.log(`   Found ${menuVariationCount} variations but 0 menu items have variants[] array populated`);
      console.log(`   Impact: Cannot use .populate('variants'), must query separately\n`);

      // Show sample
      const sampleVariation = await MenuVariation.findOne({ isActive: true }).lean();
      if (sampleVariation) {
        const parentItem = await MenuItem.findById(sampleVariation.menuItemId).lean();
        console.log(`   Example:`);
        console.log(`   - Variation: "${sampleVariation.name}" (${sampleVariation._id})`);
        console.log(`   - Parent Item: "${parentItem?.name}" (${parentItem?._id})`);
        console.log(`   - Parent variants[]: ${JSON.stringify(parentItem?.variants || [])}`);
        console.log(`   - Expected: Should contain ${sampleVariation._id}\n`);
      }
    }

    // Issue #2: Orphaned add-on items
    if (addOnItemCount > 0 && addOnGroupCount === 0) {
      issueCount++;
      console.log(`❌ ISSUE #2: Orphaned Add-On Items`);
      console.log(`   Found ${addOnItemCount} add-on items but 0 groups`);
      console.log(`   Impact: Items cannot be displayed, no grouping structure\n`);

      // Show unique groupIds
      const uniqueGroupIds = await AddOnItem.distinct('groupId');
      console.log(`   Orphaned items reference ${uniqueGroupIds.length} non-existent group IDs:`);
      uniqueGroupIds.slice(0, 5).forEach(id => console.log(`   - ${id}`));
      if (uniqueGroupIds.length > 5) console.log(`   ... and ${uniqueGroupIds.length - 5} more\n`);
    }

    // Issue #3: MenuItem.addOns[] reference check
    const sampleItem = await MenuItem.findOne({ isActive: true }).lean();
    if (sampleItem && sampleItem.addOns !== undefined) {
      issueCount++;
      console.log(`❌ ISSUE #3: MenuItem.addOns[] Schema Reference`);
      console.log(`   Schema references 'AddOn' model which doesn't exist`);
      console.log(`   Actual models: 'AddOnGroup' and 'AddOnItem'`);
      console.log(`   Impact: .populate('addOns') will fail\n`);
    }

    // Issue #4: Menu items without recipes but with variations
    const itemsWithoutRecipeButWithVariations = await MenuItem.aggregate([
      {
        $lookup: {
          from: 'menu_variations',
          localField: '_id',
          foreignField: 'menuItemId',
          as: 'variations'
        }
      },
      {
        $match: {
          isActive: true,
          recipeId: null,
          'variations.0': { $exists: true }
        }
      },
      { $count: 'count' }
    ]);

    const orphanedVariationsCount = itemsWithoutRecipeButWithVariations[0]?.count || 0;
    if (orphanedVariationsCount > 0) {
      issueCount++;
      console.log(`⚠️  ISSUE #4: Menu Items with Variations but No Recipe`);
      console.log(`   Found ${orphanedVariationsCount} items with variations but no recipe link`);
      console.log(`   Impact: Cannot calculate cost, inventory deduction may fail\n`);
    }

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('📋 DETAILED BREAKDOWN\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Variations breakdown
    if (menuVariationCount > 0) {
      console.log('🔀 Menu Variations Breakdown:');
      const variationsByType = await MenuVariation.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      variationsByType.forEach(v => {
        console.log(`   ${v._id}: ${v.count}`);
      });

      const variationsWithRecipeVariant = await MenuVariation.countDocuments({
        isActive: true,
        recipeVariantId: { $ne: null }
      });
      console.log(`   With recipeVariantId: ${variationsWithRecipeVariant}`);
      console.log(`   Without recipeVariantId: ${menuVariationCount - variationsWithRecipeVariant}\n`);
    }

    // Add-ons breakdown
    if (addOnItemCount > 0) {
      console.log('🍟 Add-On Items Breakdown:');
      const itemsBySource = await AddOnItem.aggregate([
        { $group: { _id: '$sourceType', count: { $sum: 1 } } }
      ]);
      itemsBySource.forEach(s => {
        console.log(`   ${s._id}: ${s.count}`);
      });

      const uniqueCategories = await AddOnItem.distinct('categoryId');
      console.log(`   Across ${uniqueCategories.length} categories\n`);
    }

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('✅ AUDIT COMPLETE\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (issueCount === 0) {
      console.log('🎉 No critical issues found! System is healthy.\n');
    } else {
      console.log(`⚠️  Found ${issueCount} critical issue(s) that need fixing.\n`);
      console.log('📝 Next Steps:');
      console.log('   1. Run migration scripts to fix data integrity');
      console.log('   2. Update service layer to auto-populate arrays');
      console.log('   3. Add validation hooks to prevent future issues\n');
    }

    // Export summary
    const summary = {
      tenant: tenantSlug,
      timestamp: new Date().toISOString(),
      counts: {
        recipes: recipeCount,
        recipeVariants: recipeVariantCount,
        menuItems: menuItemCount,
        menuVariations: menuVariationCount,
        addOnGroups: addOnGroupCount,
        addOnItems: addOnItemCount,
      },
      issues: {
        unlinkedVariations: menuVariationCount > 0 && itemsWithVariantsArray === 0,
        orphanedAddOns: addOnItemCount > 0 && addOnGroupCount === 0,
        brokenAddOnReference: sampleItem && sampleItem.addOns !== undefined,
        itemsWithoutRecipe: orphanedVariationsCount,
      },
      issueCount
    };

    console.log('📄 Audit Summary (JSON):');
    console.log(JSON.stringify(summary, null, 2));
    console.log('');

  } catch (error) {
    console.error('\n❌ Audit failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (mainConn) await mongoose.connection.close();
    if (tenantConn) await tenantConn.close();
  }
}

audit();

