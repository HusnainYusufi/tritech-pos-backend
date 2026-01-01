#!/usr/bin/env node
'use strict';

/**
 * ============================================================================
 * TEST: Recipe Variant Flow - Single Source of Truth
 * ============================================================================
 * 
 * Tests the complete flow of variations using RecipeVariant as single source
 * 
 * USAGE:
 *   node scripts/test-recipe-variant-flow.js <tenant-slug>
 * ============================================================================
 */

require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('../modules/logger');
const { getTenantConnection } = require('../modules/connectionManager');
const TenantRepo = require('../features/tenant/repository/tenant.repository');
const { getTenantModel } = require('../modules/tenantModels');
const menuItemSchema = require('../features/menu/model/MenuItem.schema');
const recipeSchema = require('../features/recipe/model/Recipe.schema');
const recipeVariantSchema = require('../features/recipe-variant/model/RecipeVariant.schema');
const RecipeVariantRepo = require('../features/recipe-variant/repository/recipeVariant.repository');

async function main() {
  const args = process.argv.slice(2);
  const tenantSlug = args[0];

  if (!tenantSlug) {
    console.error('❌ Usage: node scripts/test-recipe-variant-flow.js <tenant-slug>');
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
    const Recipe = getTenantModel(conn, 'Recipe', recipeSchema, 'recipes');
    const RecipeVariant = getTenantModel(conn, 'RecipeVariant', recipeVariantSchema, 'recipe_variants');

    console.log('\n' + '='.repeat(80));
    console.log('🧪 TEST: Recipe Variant Flow');
    console.log('='.repeat(80));

    // ========================================================================
    // TEST 1: Check MenuItem → Recipe linking
    // ========================================================================
    console.log('\n📋 TEST 1: MenuItem → Recipe Linking');
    console.log('-'.repeat(80));

    const menuItemsWithRecipe = await MenuItem.find({ recipeId: { $ne: null } })
      .limit(5)
      .populate('recipeId', 'name')
      .lean();

    if (menuItemsWithRecipe.length === 0) {
      console.log('⚠️  No menu items with recipes found');
    } else {
      console.log(`✅ Found ${menuItemsWithRecipe.length} menu items with recipes:`);
      menuItemsWithRecipe.forEach((item, idx) => {
        console.log(`   ${idx + 1}. ${item.name} → Recipe: ${item.recipeId?.name || 'N/A'}`);
      });
    }

    // ========================================================================
    // TEST 2: Check RecipeVariant data
    // ========================================================================
    console.log('\n📋 TEST 2: RecipeVariant Data');
    console.log('-'.repeat(80));

    const recipeVariants = await RecipeVariant.find({ isActive: true })
      .limit(10)
      .populate('recipeId', 'name')
      .lean();

    if (recipeVariants.length === 0) {
      console.log('⚠️  No recipe variants found');
      console.log('\n💡 TIP: Create recipe variants using:');
      console.log('   POST /t/recipe-variations');
      console.log('   {');
      console.log('     "recipeId": "<recipe-id>",');
      console.log('     "name": "Large",');
      console.log('     "type": "size",');
      console.log('     "sizeMultiplier": 1.5');
      console.log('   }');
    } else {
      console.log(`✅ Found ${recipeVariants.length} recipe variants:`);
      recipeVariants.forEach((v, idx) => {
        console.log(`   ${idx + 1}. ${v.name} (${v.type || 'custom'})`);
        console.log(`      Recipe: ${v.recipeId?.name || 'N/A'}`);
        console.log(`      Size Multiplier: ${v.sizeMultiplier || 1}`);
        console.log(`      Total Cost: ${v.totalCost || 0}`);
      });
    }

    // ========================================================================
    // TEST 3: Simulate Branch Menu Service Logic
    // ========================================================================
    console.log('\n📋 TEST 3: Simulating Branch Menu Service');
    console.log('-'.repeat(80));

    if (menuItemsWithRecipe.length > 0) {
      const testMenuItem = menuItemsWithRecipe[0];
      console.log(`\n🔍 Testing with: ${testMenuItem.name}`);
      console.log(`   Recipe ID: ${testMenuItem.recipeId?._id || testMenuItem.recipeId}`);

      // Fetch variations for this recipe
      const variations = await RecipeVariant.find({
        recipeId: testMenuItem.recipeId?._id || testMenuItem.recipeId,
        isActive: true
      }).lean();

      if (variations.length === 0) {
        console.log('\n⚠️  No variations found for this recipe');
      } else {
        console.log(`\n✅ Found ${variations.length} variations:`);
        variations.forEach((v, idx) => {
          console.log(`   ${idx + 1}. ${v.name}`);
          console.log(`      Type: ${v.type || 'custom'}`);
          console.log(`      Size Multiplier: ${v.sizeMultiplier || 1}`);
          console.log(`      Total Cost: ${v.totalCost || 0}`);
        });

        // Simulate POS menu response structure
        console.log('\n📦 POS Menu Response Structure:');
        const posMenuItem = {
          id: testMenuItem._id,
          name: testMenuItem.name,
          price: testMenuItem.pricing?.basePrice || 0,
          variations: variations.map(v => ({
            id: v._id,
            recipeId: v.recipeId,
            name: v.name,
            type: v.type || 'custom',
            sizeMultiplier: v.sizeMultiplier || 1,
            totalCost: v.totalCost || 0,
            metadata: v.metadata || {}
          }))
        };

        console.log(JSON.stringify(posMenuItem, null, 2));
      }
    }

    // ========================================================================
    // TEST 4: Check for orphaned MenuItem.variants[] field
    // ========================================================================
    console.log('\n📋 TEST 4: Check for Orphaned Fields');
    console.log('-'.repeat(80));

    const itemsWithVariantsField = await MenuItem.countDocuments({
      variants: { $exists: true }
    });

    if (itemsWithVariantsField > 0) {
      console.log(`⚠️  Found ${itemsWithVariantsField} menu items with variants[] field`);
      console.log('   Run migration to clean up:');
      console.log(`   node scripts/migrations/deprecate-menu-variations.js ${tenantSlug} --execute`);
    } else {
      console.log('✅ No orphaned variants[] fields found');
    }

    // ========================================================================
    // TEST 5: Summary
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));

    const totalMenuItems = await MenuItem.countDocuments({});
    const menuItemsWithRecipes = await MenuItem.countDocuments({ recipeId: { $ne: null } });
    const totalRecipes = await Recipe.countDocuments({});
    const totalRecipeVariants = await RecipeVariant.countDocuments({ isActive: true });

    console.log(`\n📦 Menu Items: ${totalMenuItems}`);
    console.log(`📦 Menu Items with Recipes: ${menuItemsWithRecipes}`);
    console.log(`📦 Recipes: ${totalRecipes}`);
    console.log(`📦 Recipe Variants: ${totalRecipeVariants}`);

    const coveragePercent = totalMenuItems > 0
      ? ((menuItemsWithRecipes / totalMenuItems) * 100).toFixed(1)
      : 0;

    console.log(`\n📊 Recipe Coverage: ${coveragePercent}%`);

    if (totalRecipeVariants === 0) {
      console.log('\n⚠️  WARNING: No recipe variants found!');
      console.log('   Create variations using: POST /t/recipe-variations');
    } else {
      console.log('\n✅ System is ready!');
    }

    console.log('\n' + '='.repeat(80));
    console.log('🎯 NEXT STEPS');
    console.log('='.repeat(80));
    console.log(`
1. Test POS Menu API:
   GET /t/pos/menu?branchId=<branch-id>

2. Test Branch Menu API:
   GET /t/branch-menu/effective?branchId=<branch-id>

3. Create more variations:
   POST /t/recipe-variations
   {
     "recipeId": "<recipe-id>",
     "name": "Large",
     "type": "size",
     "sizeMultiplier": 1.5
   }

4. Run migration (if needed):
   node scripts/migrations/deprecate-menu-variations.js ${tenantSlug} --execute
`);

    console.log('='.repeat(80));
    console.log('✅ Test completed successfully!');
    console.log('='.repeat(80));

  } catch (err) {
    logger.error('❌ Test failed:', err);
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main();

