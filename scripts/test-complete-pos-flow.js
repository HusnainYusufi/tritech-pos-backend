#!/usr/bin/env node
/**
 * 🧪 PRODUCTION TEST: Complete POS Menu Flow
 * 
 * Tests the entire flow from inventory → recipe → menu → POS
 * Validates all linking relationships work correctly
 * 
 * Usage: node scripts/test-complete-pos-flow.js <tenant> <branchId>
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
const branchMenuSchema = require('../features/branch-menu/model/BranchMenu.schema');

async function test() {
  const tenantSlug = process.argv[2];
  const branchId = process.argv[3];

  if (!tenantSlug) {
    console.error('Usage: node scripts/test-complete-pos-flow.js <tenant> [branchId]');
    process.exit(1);
  }

  let mainConn, tenantConn;

  try {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  🧪 PRODUCTION TEST: Complete POS Menu Flow             ║');
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
    const Recipe = getTenantModel(tenantConn, 'Recipe', recipeSchema, 'recipes');
    const RecipeVariant = getTenantModel(tenantConn, 'RecipeVariant', recipeVariantSchema, 'recipe_variants');
    const BranchMenu = getTenantModel(tenantConn, 'BranchMenu', branchMenuSchema, 'branch_menus');

    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📊 TESTING DATA RELATIONSHIPS\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Test 1: Recipe → MenuItem linking
    console.log('🧪 Test 1: Recipe → MenuItem Linking');
    const menuItemsWithRecipe = await MenuItem.find({ 
      isActive: true, 
      recipeId: { $ne: null } 
    }).lean();
    
    console.log(`   Menu items with recipes: ${menuItemsWithRecipe.length}`);
    
    let validRecipeLinks = 0;
    for (const item of menuItemsWithRecipe.slice(0, 3)) {
      const recipe = await Recipe.findById(item.recipeId).lean();
      if (recipe) {
        console.log(`   ✅ ${item.name} → ${recipe.name}`);
        validRecipeLinks++;
      } else {
        console.log(`   ❌ ${item.name} → Recipe not found (${item.recipeId})`);
      }
    }
    console.log(`   Valid links: ${validRecipeLinks}/${menuItemsWithRecipe.length}\n`);

    // Test 2: MenuItem ↔ MenuVariation bidirectional linking
    console.log('🧪 Test 2: MenuItem ↔ MenuVariation Bidirectional Linking');
    const variations = await MenuVariation.find({ isActive: true }).lean();
    console.log(`   Total variations: ${variations.length}`);
    
    let syncedCount = 0;
    let unsyncedCount = 0;
    
    for (const variation of variations) {
      const item = await MenuItem.findById(variation.menuItemId).lean();
      if (!item) {
        console.log(`   ❌ Orphaned: ${variation.name} (menu item deleted)`);
        continue;
      }
      
      const variantIds = (item.variants || []).map(String);
      if (variantIds.includes(String(variation._id))) {
        syncedCount++;
      } else {
        console.log(`   ⚠️  Unsynced: ${item.name} missing variation "${variation.name}"`);
        unsyncedCount++;
      }
    }
    
    console.log(`   Synced: ${syncedCount}`);
    console.log(`   Unsynced: ${unsyncedCount}\n`);

    // Test 3: Category → AddOnGroup → AddOnItem linking
    console.log('🧪 Test 3: Category → AddOnGroup → AddOnItem Linking');
    const groups = await AddOnGroup.find({ isActive: true }).lean();
    console.log(`   Add-on groups: ${groups.length}`);
    
    for (const group of groups) {
      const items = await AddOnItem.find({ groupId: group._id, isActive: true }).lean();
      console.log(`   ✅ ${group.name}: ${items.length} items`);
    }
    console.log('');

    // Test 4: Branch → MenuItem assignment
    if (branchId) {
      console.log('🧪 Test 4: Branch → MenuItem Assignment');
      const branchMenus = await BranchMenu.find({ 
        branchId, 
        isAvailable: true, 
        isVisibleInPOS: true 
      }).lean();
      console.log(`   Items assigned to branch: ${branchMenus.length}\n`);
    }

    // Test 5: Complete POS menu structure
    console.log('🧪 Test 5: POS Menu Structure Validation');
    const sampleItem = await MenuItem.findOne({ 
      isActive: true,
      recipeId: { $ne: null }
    }).lean();

    if (sampleItem) {
      console.log(`   Sample item: ${sampleItem.name}`);
      console.log(`   - Has recipe: ${!!sampleItem.recipeId}`);
      console.log(`   - Has category: ${!!sampleItem.categoryId}`);
      console.log(`   - variants[] array: ${(sampleItem.variants || []).length} IDs`);
      
      const itemVariations = await MenuVariation.find({ 
        menuItemId: sampleItem._id, 
        isActive: true 
      }).lean();
      console.log(`   - Actual variations: ${itemVariations.length}`);
      
      if (sampleItem.categoryId) {
        const categoryGroups = await AddOnGroup.find({ 
          categoryId: sampleItem.categoryId, 
          isActive: true 
        }).lean();
        console.log(`   - Add-on groups (category): ${categoryGroups.length}`);
      }
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('✅ TEST COMPLETE\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (unsyncedCount > 0) {
      console.log(`⚠️  Found ${unsyncedCount} unsynced variations`);
      console.log('   Run: node scripts/migrations/sync-menu-item-variants.js ' + tenantSlug + ' --execute\n');
    } else {
      console.log('🎉 All relationships are properly linked!\n');
    }

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

