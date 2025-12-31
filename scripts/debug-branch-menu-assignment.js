#!/usr/bin/env node
/**
 * 🔍 DEBUG: Branch Menu Assignment
 * 
 * Checks why menu items are not showing in branch menu effective API
 * 
 * Usage: node scripts/debug-branch-menu-assignment.js <tenant> <branchId>
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Tenant = require('../features/tenant/model/Tenant.model');
const { withAuthSource } = require('../modules/mongoUri');
const { getTenantModel } = require('../modules/tenantModels');

const menuItemSchema = require('../features/menu/model/MenuItem.schema');
const branchMenuSchema = require('../features/branch-menu/model/BranchMenu.schema');
const branchSchema = require('../features/branch/model/Branch.schema');

async function debug() {
  const tenantSlug = process.argv[2];
  const branchId = process.argv[3];

  if (!tenantSlug || !branchId) {
    console.error('Usage: node scripts/debug-branch-menu-assignment.js <tenant> <branchId>');
    process.exit(1);
  }

  let mainConn, tenantConn;

  try {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  🔍 DEBUG: Branch Menu Assignment                        ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    mainConn = await mongoose.connect(process.env.MONGO_URI);
    const tenant = await Tenant.findOne({ slug: tenantSlug }).lean();
    if (!tenant?.dbUri) throw new Error(`Tenant ${tenantSlug} not found`);

    tenantConn = await mongoose.createConnection(withAuthSource(tenant.dbUri));
    console.log(`✅ Connected: ${tenant.name}\n`);

    const MenuItem = getTenantModel(tenantConn, 'MenuItem', menuItemSchema, 'menu_items');
    const BranchMenu = getTenantModel(tenantConn, 'BranchMenu', branchMenuSchema, 'branch_menus');
    const Branch = getTenantModel(tenantConn, 'Branch', branchSchema, 'branches');

    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📊 CHECKING DATA\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    // 1. Check if branch exists
    console.log('1️⃣  Checking Branch...');
    const branch = await Branch.findById(branchId).lean();
    if (!branch) {
      console.log(`   ❌ Branch not found: ${branchId}\n`);
      process.exit(1);
    }
    console.log(`   ✅ Branch found: ${branch.name} (${branch.code})\n`);

    // 2. Check active menu items
    console.log('2️⃣  Checking Menu Items...');
    const menuItems = await MenuItem.find({ isActive: true }).lean();
    console.log(`   ✅ Active menu items: ${menuItems.length}\n`);
    
    if (menuItems.length > 0) {
      console.log('   Sample items:');
      menuItems.slice(0, 5).forEach(item => {
        console.log(`   - ${item.name} (${item._id})`);
      });
      console.log('');
    }

    // 3. Check branch menu assignments
    console.log('3️⃣  Checking Branch Menu Assignments...');
    const branchMenus = await BranchMenu.find({ branchId }).lean();
    console.log(`   📋 Total assignments for this branch: ${branchMenus.length}\n`);

    if (branchMenus.length === 0) {
      console.log('   ⚠️  NO MENU ITEMS ASSIGNED TO THIS BRANCH!\n');
      console.log('   This is why /effective API returns empty.\n');
      console.log('   ═══════════════════════════════════════════════════════════\n');
      console.log('   🔧 HOW TO FIX:\n');
      console.log('   You need to assign menu items to the branch using:\n');
      console.log('   POST /t/branch-menu');
      console.log('   {');
      console.log('     "branchId": "' + branchId + '",');
      console.log('     "menuItemId": "<menu_item_id>",');
      console.log('     "isAvailable": true,');
      console.log('     "isVisibleInPOS": true');
      console.log('   }\n');
      console.log('   Or use bulk assignment if available.\n');
      console.log('   ═══════════════════════════════════════════════════════════\n');
    } else {
      console.log('   ✅ Assigned items:');
      branchMenus.slice(0, 10).forEach(bm => {
        console.log(`   - ${bm.menuItemNameSnapshot || 'Unknown'} (${bm.menuItemId})`);
        console.log(`     Available: ${bm.isAvailable}, Visible in POS: ${bm.isVisibleInPOS}`);
      });
      console.log('');

      // 4. Check if assigned items are still active
      console.log('4️⃣  Checking Assignment Validity...');
      const assignedItemIds = branchMenus.map(bm => bm.menuItemId);
      const activeAssignedItems = await MenuItem.find({
        _id: { $in: assignedItemIds },
        isActive: true
      }).lean();

      console.log(`   Active assigned items: ${activeAssignedItems.length}/${branchMenus.length}\n`);

      if (activeAssignedItems.length < branchMenus.length) {
        console.log('   ⚠️  Some assigned items are inactive or deleted!');
        const activeIds = activeAssignedItems.map(i => String(i._id));
        const inactiveAssignments = branchMenus.filter(bm => 
          !activeIds.includes(String(bm.menuItemId))
        );
        console.log(`   Inactive assignments: ${inactiveAssignments.length}`);
        inactiveAssignments.forEach(bm => {
          console.log(`   - ${bm.menuItemNameSnapshot} (${bm.menuItemId})`);
        });
        console.log('');
      }
    }

    // 5. Check what /effective API would return
    console.log('5️⃣  Simulating /effective API Query...');
    const menuItemIds = menuItems.map(m => m._id);
    const effectiveConfigs = await BranchMenu.find({
      branchId,
      menuItemId: { $in: menuItemIds }
    }).lean();

    console.log(`   Items that would appear in /effective: ${effectiveConfigs.length}\n`);

    if (effectiveConfigs.length === 0) {
      console.log('   ❌ NO ITEMS WOULD APPEAR IN /effective API\n');
      console.log('   Reason: No active menu items are assigned to this branch.\n');
    } else {
      console.log('   ✅ Items that would appear:');
      effectiveConfigs.forEach(cfg => {
        console.log(`   - ${cfg.menuItemNameSnapshot}`);
      });
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📋 SUMMARY\n');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Branch: ${branch.name}`);
    console.log(`Total Menu Items (Active): ${menuItems.length}`);
    console.log(`Assigned to Branch: ${branchMenus.length}`);
    console.log(`Would Show in /effective: ${effectiveConfigs.length}\n`);

    if (effectiveConfigs.length === 0) {
      console.log('🔴 PROBLEM: No menu items assigned to branch!\n');
      console.log('✅ SOLUTION: Use POST /t/branch-menu to assign items\n');
    } else {
      console.log('✅ Branch menu is properly configured!\n');
    }

    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    if (mainConn) await mongoose.connection.close();
    if (tenantConn) await tenantConn.close();
  }
}

debug();

