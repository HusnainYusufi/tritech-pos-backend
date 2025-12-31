#!/usr/bin/env node
/**
 * 🔧 PRODUCTION MIGRATION: Sync MenuItem.variants[] Arrays
 * 
 * For Food Chain POS - Ensures all MenuItem.variants[] arrays are in sync
 * with their MenuVariation documents.
 * 
 * Safety: Dry-run by default, --execute to apply
 * Usage: node scripts/migrations/sync-menu-item-variants.js <tenant> [--execute]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Tenant = require('../../features/tenant/model/Tenant.model');
const { withAuthSource } = require('../../modules/mongoUri');
const { getTenantModel } = require('../../modules/tenantModels');

const menuItemSchema = require('../../features/menu/model/MenuItem.schema');
const menuVariationSchema = require('../../features/menu/model/MenuVariation.schema');

async function sync() {
  const tenantSlug = process.argv[2];
  const execute = process.argv.includes('--execute');

  if (!tenantSlug) {
    console.error('Usage: node scripts/migrations/sync-menu-item-variants.js <tenant> [--execute]');
    process.exit(1);
  }

  let mainConn, tenantConn;

  try {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  🔧 SYNC MenuItem.variants[] Arrays                      ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    console.log(execute ? '✅ EXECUTE MODE\n' : '⚠️  DRY RUN MODE\n');

    mainConn = await mongoose.connect(process.env.MONGO_URI);
    const tenant = await Tenant.findOne({ slug: tenantSlug }).lean();
    if (!tenant?.dbUri) throw new Error(`Tenant ${tenantSlug} not found`);

    tenantConn = await mongoose.createConnection(withAuthSource(tenant.dbUri));
    console.log(`✅ Connected: ${tenant.name}\n`);

    const MenuItem = getTenantModel(tenantConn, 'MenuItem', menuItemSchema, 'menu_items');
    const MenuVariation = getTenantModel(tenantConn, 'MenuVariation', menuVariationSchema, 'menu_variations');

    // Get all variations grouped by menuItemId
    const variations = await MenuVariation.find({ isActive: true }).lean();
    const varsByItem = new Map();
    
    for (const v of variations) {
      const key = String(v.menuItemId);
      if (!varsByItem.has(key)) varsByItem.set(key, []);
      varsByItem.get(key).push(v);
    }

    console.log(`Found ${variations.length} variations for ${varsByItem.size} menu items\n`);

    let fixed = 0, correct = 0, errors = 0;

    for (const [itemId, vars] of varsByItem.entries()) {
      const item = await MenuItem.findById(itemId).lean();
      if (!item) {
        console.log(`⚠️  Orphaned: ${vars.length} variations for deleted item ${itemId}`);
        errors++;
        continue;
      }

      const current = (item.variants || []).map(String);
      const expected = vars.map(v => String(v._id));
      const missing = expected.filter(id => !current.includes(id));

      if (missing.length === 0) {
        correct++;
        continue;
      }

      console.log(`🔧 ${item.name}`);
      console.log(`   Current: ${current.length}, Expected: ${expected.length}`);
      console.log(`   Missing: ${missing.length} IDs\n`);

      if (execute) {
        await MenuItem.findByIdAndUpdate(itemId, { $set: { variants: expected } });
        console.log(`   ✅ Synced\n`);
      }

      fixed++;
    }

    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Already correct: ${correct}`);
    console.log(`Need fixing: ${fixed}`);
    console.log(`Errors: ${errors}\n`);

    if (!execute && fixed > 0) {
      console.log(`Run with --execute to apply changes\n`);
    } else if (execute && fixed > 0) {
      console.log(`✅ Synced ${fixed} menu items\n`);
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    if (mainConn) await mongoose.connection.close();
    if (tenantConn) await tenantConn.close();
  }
}

sync();

