#!/usr/bin/env node
/**
 * 🔧 PRODUCTION MIGRATION: Auto-Create MenuVariations from RecipeVariants
 * 
 * This script solves the problem where RecipeVariants exist but MenuVariations don't.
 * It creates MenuVariations automatically based on RecipeVariants with intelligent pricing.
 * 
 * Safety: Dry-run by default, --execute to apply
 * Usage: node scripts/migrations/create-menu-variations-from-recipe-variants.js <tenant> [--execute] [--markup=1.5]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Tenant = require('../../features/tenant/model/Tenant.model');
const { withAuthSource } = require('../../modules/mongoUri');
const { getTenantModel } = require('../../modules/tenantModels');

const menuItemSchema = require('../../features/menu/model/MenuItem.schema');
const menuVariationSchema = require('../../features/menu/model/MenuVariation.schema');
const recipeSchema = require('../../features/recipe/model/Recipe.schema');
const recipeVariantSchema = require('../../features/recipe-variant/model/RecipeVariant.schema');

async function migrate() {
  const tenantSlug = process.argv[2];
  const execute = process.argv.includes('--execute');
  const markupArg = process.argv.find(arg => arg.startsWith('--markup='));
  const markup = markupArg ? parseFloat(markupArg.split('=')[1]) : 1.5; // Default 50% markup

  if (!tenantSlug) {
    console.error('Usage: node scripts/migrations/create-menu-variations-from-recipe-variants.js <tenant> [--execute] [--markup=1.5]');
    process.exit(1);
  }

  let mainConn, tenantConn;

  try {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  🔧 AUTO-CREATE MenuVariations from RecipeVariants       ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    console.log(execute ? '✅ EXECUTE MODE\n' : '⚠️  DRY RUN MODE\n');
    console.log(`💰 Markup: ${markup}x (${((markup - 1) * 100).toFixed(0)}% profit margin)\n`);

    mainConn = await mongoose.connect(process.env.MONGO_URI);
    const tenant = await Tenant.findOne({ slug: tenantSlug }).lean();
    if (!tenant?.dbUri) throw new Error(`Tenant ${tenantSlug} not found`);

    tenantConn = await mongoose.createConnection(withAuthSource(tenant.dbUri));
    console.log(`✅ Connected: ${tenant.name}\n`);

    const MenuItem = getTenantModel(tenantConn, 'MenuItem', menuItemSchema, 'menu_items');
    const MenuVariation = getTenantModel(tenantConn, 'MenuVariation', menuVariationSchema, 'menu_variations');
    const Recipe = getTenantModel(tenantConn, 'Recipe', recipeSchema, 'recipes');
    const RecipeVariant = getTenantModel(tenantConn, 'RecipeVariant', recipeVariantSchema, 'recipe_variants');

    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📊 ANALYZING DATA\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Get all menu items with recipes
    const menuItems = await MenuItem.find({ 
      isActive: true,
      recipeId: { $ne: null }
    }).lean();

    console.log(`Menu items with recipes: ${menuItems.length}\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const item of menuItems) {
      console.log(`\n📋 ${item.name} (${item._id})`);
      console.log(`   Recipe: ${item.recipeId}`);

      // Get recipe
      const recipe = await Recipe.findById(item.recipeId).lean();
      if (!recipe) {
        console.log(`   ⚠️  Recipe not found, skipping`);
        errors++;
        continue;
      }

      // Get recipe variants
      const recipeVariants = await RecipeVariant.find({
        recipeId: item.recipeId,
        isActive: true
      }).lean();

      console.log(`   Recipe variants: ${recipeVariants.length}`);

      if (recipeVariants.length === 0) {
        console.log(`   ℹ️  No recipe variants, skipping`);
        skipped++;
        continue;
      }

      // Check existing menu variations
      const existingMenuVars = await MenuVariation.find({
        menuItemId: item._id
      }).lean();

      console.log(`   Existing menu variations: ${existingMenuVars.length}`);

      // Get base cost (from base recipe or smallest variant)
      const baseCost = recipe.totalCost || 0;
      const basePrice = item.pricing?.basePrice || 0;

      console.log(`   Base cost: ${baseCost.toFixed(2)}`);
      console.log(`   Base price: ${basePrice.toFixed(2)}`);

      // Create menu variations for each recipe variant
      for (const recipeVar of recipeVariants) {
        // Check if menu variation already exists
        const exists = existingMenuVars.find(mv => 
          String(mv.recipeVariantId) === String(recipeVar._id) ||
          mv.name === recipeVar.name
        );

        if (exists) {
          console.log(`   ✓ Already exists: ${recipeVar.name}`);
          skipped++;
          continue;
        }

        // Calculate intelligent price delta
        const variantCost = recipeVar.totalCost || 0;
        const costDelta = variantCost - baseCost;
        
        // Price delta = cost delta * markup
        // This ensures profit margin is maintained
        const priceDelta = Math.round(costDelta * markup);

        console.log(`   🔧 Creating: ${recipeVar.name}`);
        console.log(`      Cost delta: ${costDelta.toFixed(2)}`);
        console.log(`      Price delta: ${priceDelta.toFixed(2)}`);
        console.log(`      Size multiplier: ${recipeVar.sizeMultiplier || 1}`);

        if (execute) {
          try {
            const menuVarData = {
              menuItemId: item._id,
              recipeVariantId: recipeVar._id,
              name: recipeVar.name,
              type: recipeVar.type || 'size',
              priceDelta: priceDelta,
              sizeMultiplier: recipeVar.sizeMultiplier || 1,
              costDelta: costDelta,
              calculatedCost: variantCost,
              crustType: recipeVar.crustType || '',
              flavorTag: recipeVar.flavorTag || '',
              ingredients: recipeVar.ingredients || [],
              isDefault: recipeVar.isDefault || false,
              isActive: true,
              displayOrder: recipeVar.displayOrder || 0,
              metadata: {
                autoCreated: true,
                createdFrom: 'recipeVariant',
                recipeVariantId: recipeVar._id,
                markup: markup
              }
            };

            const menuVar = await MenuVariation.create(menuVarData);

            // Auto-update MenuItem.variants[] array
            await MenuItem.findByIdAndUpdate(
              item._id,
              { $addToSet: { variants: menuVar._id } }
            );

            console.log(`      ✅ Created (ID: ${menuVar._id})`);
            created++;
          } catch (err) {
            console.log(`      ❌ Error: ${err.message}`);
            errors++;
          }
        } else {
          console.log(`      ⚠️  Would create (dry run)`);
          created++;
        }
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');
    console.log('📊 SUMMARY\n');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Menu items processed: ${menuItems.length}`);
    console.log(`Menu variations created: ${created}`);
    console.log(`Skipped (already exist): ${skipped}`);
    console.log(`Errors: ${errors}\n`);

    if (!execute && created > 0) {
      console.log(`⚠️  DRY RUN: No changes made`);
      console.log(`Run with --execute to create ${created} menu variations\n`);
      console.log(`Example: node scripts/migrations/create-menu-variations-from-recipe-variants.js ${tenantSlug} --execute --markup=1.5\n`);
    } else if (execute && created > 0) {
      console.log(`✅ Successfully created ${created} menu variations!\n`);
      console.log(`🎯 Next steps:`);
      console.log(`1. Test POS menu API: GET /t/pos/menu?branchId=<branch_id>`);
      console.log(`2. Verify variations appear in response`);
      console.log(`3. Adjust pricing if needed via PUT /t/menu-variations/:id\n`);
    } else if (created === 0) {
      console.log(`ℹ️  No menu variations needed to be created\n`);
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

migrate();

