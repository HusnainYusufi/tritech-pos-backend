#!/usr/bin/env node
/**
 * 🔧 PRODUCTION MIGRATION: Generate MenuVariations from RecipeVariants
 * 
 * This script bridges the gap between backend (RecipeVariants) and frontend (MenuVariations)
 * by auto-generating customer-facing menu variations from your existing recipe variants.
 * 
 * WHAT IT DOES:
 * 1. Reads all RecipeVariants linked to menu items
 * 2. Creates corresponding MenuVariations for POS display
 * 3. Calculates intelligent price deltas based on cost differences
 * 4. Links them properly via recipeVariantId
 * 5. Syncs MenuItem.variants[] arrays
 * 
 * SAFETY:
 * - Dry-run by default
 * - Skips existing MenuVariations
 * - Validates all data before creation
 * - Comprehensive logging
 * 
 * Usage: node scripts/migrations/generate-menu-variations-from-recipe-variants.js <tenant> [--execute] [--markup=2.5]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Tenant = require('../../features/tenant/model/Tenant.model');
const { withAuthSource } = require('../../modules/mongoUri');
const { getTenantModel } = require('../../modules/tenantModels');

const menuItemSchema = require('../../features/menu/model/MenuItem.schema');
const menuVariationSchema = require('../../features/menu/model/MenuVariation.schema');
const recipeVariantSchema = require('../../features/recipe-variant/model/RecipeVariant.schema');
const recipeSchema = require('../../features/recipe/model/Recipe.schema');

async function migrate() {
  const tenantSlug = process.argv[2];
  const execute = process.argv.includes('--execute');
  
  // Default markup: 2.5x (cost × 2.5 = selling price delta)
  const markupArg = process.argv.find(arg => arg.startsWith('--markup='));
  const markup = markupArg ? parseFloat(markupArg.split('=')[1]) : 2.5;

  if (!tenantSlug) {
    console.error('Usage: node scripts/migrations/generate-menu-variations-from-recipe-variants.js <tenant> [--execute] [--markup=2.5]');
    console.error('\nOptions:');
    console.error('  --execute       Apply changes (default: dry-run)');
    console.error('  --markup=X      Price markup multiplier (default: 2.5)');
    console.error('\nExample:');
    console.error('  node scripts/migrations/generate-menu-variations-from-recipe-variants.js mycafe --markup=3.0 --execute');
    process.exit(1);
  }

  let mainConn, tenantConn;

  try {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  🔧 GENERATE MenuVariations from RecipeVariants          ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    console.log(execute ? '✅ EXECUTE MODE\n' : '⚠️  DRY RUN MODE\n');
    console.log(`📊 Markup: ${markup}x (cost difference × ${markup} = price delta)\n`);

    mainConn = await mongoose.connect(process.env.MONGO_URI);
    const tenant = await Tenant.findOne({ slug: tenantSlug }).lean();
    if (!tenant?.dbUri) throw new Error(`Tenant ${tenantSlug} not found`);

    tenantConn = await mongoose.createConnection(withAuthSource(tenant.dbUri));
    console.log(`✅ Connected: ${tenant.name}\n`);

    const MenuItem = getTenantModel(tenantConn, 'MenuItem', menuItemSchema, 'menu_items');
    const MenuVariation = getTenantModel(tenantConn, 'MenuVariation', menuVariationSchema, 'menu_variations');
    const RecipeVariant = getTenantModel(tenantConn, 'RecipeVariant', recipeVariantSchema, 'recipe_variants');
    const Recipe = getTenantModel(tenantConn, 'Recipe', recipeSchema, 'recipes');

    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📊 ANALYZING DATA\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Get all menu items with recipes
    const menuItems = await MenuItem.find({ 
      isActive: true, 
      recipeId: { $ne: null } 
    }).lean();

    console.log(`Menu items with recipes: ${menuItems.length}\n`);

    if (menuItems.length === 0) {
      console.log('⚠️  No menu items with recipes found. Nothing to migrate.\n');
      process.exit(0);
    }

    // Get all recipe variants for these items
    const recipeIds = menuItems.map(item => item.recipeId).filter(Boolean);
    const recipeVariants = await RecipeVariant.find({
      recipeId: { $in: recipeIds },
      isActive: true
    }).lean();

    console.log(`Recipe variants found: ${recipeVariants.length}\n`);

    if (recipeVariants.length === 0) {
      console.log('⚠️  No recipe variants found. Nothing to migrate.\n');
      process.exit(0);
    }

    // Get base recipes for cost calculation
    const recipes = await Recipe.find({ _id: { $in: recipeIds } }).lean();
    const recipeMap = new Map(recipes.map(r => [String(r._id), r]));

    // Get existing menu variations to avoid duplicates
    const existingVariations = await MenuVariation.find({
      menuItemId: { $in: menuItems.map(m => m._id) }
    }).lean();

    const existingMap = new Map();
    existingVariations.forEach(v => {
      const key = `${v.menuItemId}_${v.recipeVariantId || 'null'}`;
      existingMap.set(key, v);
    });

    console.log(`Existing menu variations: ${existingVariations.length}\n`);

    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('🔄 PROCESSING\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    let created = 0;
    let skipped = 0;
    let errors = 0;

    const toCreate = [];

    for (const item of menuItems) {
      const recipe = recipeMap.get(String(item.recipeId));
      if (!recipe) {
        console.log(`⚠️  ${item.name}: Recipe not found, skipping`);
        errors++;
        continue;
      }

      const baseCost = recipe.totalCost || 0;
      const itemVariants = recipeVariants.filter(rv => String(rv.recipeId) === String(item.recipeId));

      if (itemVariants.length === 0) {
        console.log(`⚠️  ${item.name}: No recipe variants, skipping`);
        continue;
      }

      console.log(`\n📦 ${item.name} (${itemVariants.length} variants)`);
      console.log(`   Base cost: ${baseCost.toFixed(2)} ${item.pricing?.currency || 'PKR'}`);

      for (const recipeVariant of itemVariants) {
        const key = `${item._id}_${recipeVariant._id}`;
        
        if (existingMap.has(key)) {
          console.log(`   ⏭️  ${recipeVariant.name}: Already exists, skipping`);
          skipped++;
          continue;
        }

        // Calculate intelligent price delta
        const variantCost = recipeVariant.totalCost || baseCost;
        const costDifference = variantCost - baseCost;
        const priceDelta = Math.round(costDifference * markup);

        // Determine display order based on size multiplier
        const displayOrder = recipeVariant.sizeMultiplier 
          ? Math.round(recipeVariant.sizeMultiplier * 10)
          : 10;

        const menuVariation = {
          menuItemId: item._id,
          recipeVariantId: recipeVariant._id,
          name: recipeVariant.name,
          type: recipeVariant.type || 'size',
          priceDelta: priceDelta,
          sizeMultiplier: recipeVariant.sizeMultiplier || 1.0,
          costDelta: costDifference, // Deprecated but kept for compatibility
          calculatedCost: variantCost,
          crustType: recipeVariant.crustType || '',
          flavorTag: recipeVariant.flavorTag || '',
          ingredients: recipeVariant.ingredients || [],
          isDefault: recipeVariant.isDefault || false,
          isActive: true,
          displayOrder: displayOrder,
          metadata: {
            autoGenerated: true,
            sourceRecipeVariantId: recipeVariant._id,
            generatedAt: new Date().toISOString(),
            markup: markup
          }
        };

        console.log(`   ✅ ${recipeVariant.name}:`);
        console.log(`      Cost: ${variantCost.toFixed(2)} (${costDifference >= 0 ? '+' : ''}${costDifference.toFixed(2)})`);
        console.log(`      Price Delta: ${priceDelta >= 0 ? '+' : ''}${priceDelta} ${item.pricing?.currency || 'PKR'}`);
        console.log(`      Size Multiplier: ${recipeVariant.sizeMultiplier || 1.0}x`);

        toCreate.push({
          menuItemId: item._id,
          menuItemName: item.name,
          variation: menuVariation
        });

        created++;
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');
    console.log('📊 SUMMARY\n');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`To create: ${created}`);
    console.log(`Already exist: ${skipped}`);
    console.log(`Errors: ${errors}\n`);

    if (execute && created > 0) {
      console.log('💾 CREATING MENU VARIATIONS...\n');

      for (const item of toCreate) {
        try {
          const doc = await MenuVariation.create(item.variation);
          
          // Auto-populate MenuItem.variants[] array
          await MenuItem.findByIdAndUpdate(
            item.menuItemId,
            { $addToSet: { variants: doc._id } }
          );

          console.log(`✅ Created: ${item.menuItemName} - ${item.variation.name}`);
        } catch (err) {
          console.error(`❌ Failed: ${item.menuItemName} - ${item.variation.name}`);
          console.error(`   Error: ${err.message}`);
          errors++;
        }
      }

      console.log('\n═══════════════════════════════════════════════════════════\n');
      console.log(`✅ MIGRATION COMPLETE\n`);
      console.log(`   Created: ${created - errors}`);
      console.log(`   Failed: ${errors}\n`);

      if (errors === 0) {
        console.log('🎉 All menu variations created successfully!\n');
        console.log('Next steps:');
        console.log('1. Test POS menu API: GET /t/pos/menu?branchId=<branch_id>');
        console.log('2. Verify variations appear in response');
        console.log('3. Adjust price deltas if needed via PUT /t/menu-variations/:id\n');
      }

    } else if (!execute && created > 0) {
      console.log('⚠️  DRY RUN: No changes made\n');
      console.log('To apply changes, run with --execute flag:\n');
      console.log(`node scripts/migrations/generate-menu-variations-from-recipe-variants.js ${tenantSlug} --markup=${markup} --execute\n`);
    } else {
      console.log('✅ Nothing to create. All menu variations already exist!\n');
    }

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    if (mainConn) await mongoose.connection.close();
    if (tenantConn) await tenantConn.close();
  }
}

migrate();

