/**
 * Migration: Add Variation Support to Menu and Orders
 * 
 * This migration adds the critical missing link between MenuVariations and RecipeVariants
 * and updates PosOrders to capture selected variations.
 * 
 * Changes:
 * 1. Add recipeVariantId and calculatedCost to MenuVariation schema
 * 2. Add selectedVariations to PosOrder items
 * 3. Create unique index on (menuItemId, name) for MenuVariation
 * 4. Add indexes for performance
 * 
 * @author Engineering Team
 * @date 2025-01-01
 * @version 1.0.0
 */

'use strict';

const mongoose = require('mongoose');
const logger = require('../../modules/logger');

/**
 * Run migration for a single tenant database
 */
async function migrateTenant(tenantDb, tenantSlug) {
  const startTime = Date.now();
  
  logger.info(`[Migration] Starting for tenant: ${tenantSlug}`);

  try {
    // ========================================
    // STEP 1: Update MenuVariation collection
    // ========================================
    
    logger.info(`[Migration] Updating MenuVariation documents...`);
    
    const menuVariationResult = await tenantDb.collection('menu_variations').updateMany(
      { 
        $or: [
          { recipeVariantId: { $exists: false } },
          { calculatedCost: { $exists: false } }
        ]
      },
      { 
        $set: { 
          recipeVariantId: null,
          calculatedCost: 0
        } 
      }
    );

    logger.info(`[Migration] MenuVariation updated: ${menuVariationResult.modifiedCount} documents`);

    // ========================================
    // STEP 2: Create unique index on MenuVariation
    // ========================================
    
    logger.info(`[Migration] Creating unique index on MenuVariation...`);
    
    try {
      await tenantDb.collection('menu_variations').createIndex(
        { menuItemId: 1, name: 1 },
        { 
          unique: true,
          name: 'menuItemId_1_name_1_unique'
        }
      );
      logger.info(`[Migration] ✅ Unique index created on (menuItemId, name)`);
    } catch (error) {
      if (error.code === 11000) {
        logger.warn(`[Migration] ⚠️ Duplicate variations found. Please clean up manually.`);
        // List duplicates for manual cleanup
        const duplicates = await tenantDb.collection('menu_variations').aggregate([
          {
            $group: {
              _id: { menuItemId: '$menuItemId', name: '$name' },
              count: { $sum: 1 },
              ids: { $push: '$_id' }
            }
          },
          {
            $match: { count: { $gt: 1 } }
          }
        ]).toArray();
        
        logger.warn(`[Migration] Duplicate variations:`, duplicates);
      } else {
        throw error;
      }
    }

    // ========================================
    // STEP 3: Create additional indexes
    // ========================================
    
    logger.info(`[Migration] Creating additional indexes...`);
    
    await tenantDb.collection('menu_variations').createIndex(
      { recipeVariantId: 1 },
      { name: 'recipeVariantId_1' }
    );

    // ========================================
    // STEP 4: Update PosOrder collection
    // ========================================
    
    logger.info(`[Migration] Updating PosOrder documents...`);
    
    const posOrderResult = await tenantDb.collection('pos_orders').updateMany(
      { 
        'items.selectedVariations': { $exists: false }
      },
      { 
        $set: { 
          'items.$[].selectedVariations': [],
          'items.$[].calculatedCost': 0
        } 
      }
    );

    logger.info(`[Migration] PosOrder updated: ${posOrderResult.modifiedCount} documents`);

    // ========================================
    // STEP 5: Validation
    // ========================================
    
    logger.info(`[Migration] Running validation...`);
    
    const menuVariationCount = await tenantDb.collection('menu_variations').countDocuments();
    const posOrderCount = await tenantDb.collection('pos_orders').countDocuments();
    
    const menuVariationsWithNewFields = await tenantDb.collection('menu_variations').countDocuments({
      recipeVariantId: { $exists: true },
      calculatedCost: { $exists: true }
    });
    
    const posOrdersWithNewFields = await tenantDb.collection('pos_orders').countDocuments({
      'items.selectedVariations': { $exists: true }
    });

    const duration = Date.now() - startTime;

    logger.info(`[Migration] ✅ Completed successfully for ${tenantSlug}`, {
      duration: `${duration}ms`,
      menuVariations: {
        total: menuVariationCount,
        updated: menuVariationsWithNewFields
      },
      posOrders: {
        total: posOrderCount,
        updated: posOrdersWithNewFields
      }
    });

    return {
      success: true,
      tenantSlug,
      duration,
      stats: {
        menuVariations: {
          total: menuVariationCount,
          updated: menuVariationsWithNewFields
        },
        posOrders: {
          total: posOrderCount,
          updated: posOrdersWithNewFields
        }
      }
    };

  } catch (error) {
    logger.error(`[Migration] ❌ Failed for tenant: ${tenantSlug}`, {
      error: error.message,
      stack: error.stack
    });
    
    return {
      success: false,
      tenantSlug,
      error: error.message
    };
  }
}

/**
 * Rollback migration for a single tenant
 */
async function rollbackTenant(tenantDb, tenantSlug) {
  logger.info(`[Migration Rollback] Starting for tenant: ${tenantSlug}`);

  try {
    // Remove added fields from MenuVariation
    await tenantDb.collection('menu_variations').updateMany(
      {},
      { 
        $unset: { 
          recipeVariantId: '',
          calculatedCost: ''
        } 
      }
    );

    // Remove added fields from PosOrder
    await tenantDb.collection('pos_orders').updateMany(
      {},
      { 
        $unset: { 
          'items.$[].selectedVariations': '',
          'items.$[].calculatedCost': ''
        } 
      }
    );

    // Drop unique index
    try {
      await tenantDb.collection('menu_variations').dropIndex('menuItemId_1_name_1_unique');
    } catch (error) {
      logger.warn(`[Migration Rollback] Index may not exist: ${error.message}`);
    }

    // Drop recipeVariantId index
    try {
      await tenantDb.collection('menu_variations').dropIndex('recipeVariantId_1');
    } catch (error) {
      logger.warn(`[Migration Rollback] Index may not exist: ${error.message}`);
    }

    logger.info(`[Migration Rollback] ✅ Completed for ${tenantSlug}`);
    
    return { success: true, tenantSlug };

  } catch (error) {
    logger.error(`[Migration Rollback] ❌ Failed for tenant: ${tenantSlug}`, {
      error: error.message
    });
    
    return { success: false, tenantSlug, error: error.message };
  }
}

/**
 * Run migration for all tenants
 */
async function migrateAll() {
  const TenantRepo = require('../../features/tenant/repository/tenant.repository');
  const { getConnection } = require('../../modules/connectionManager');

  logger.info('[Migration] Starting migration for all tenants...');

  try {
    // Get main connection to fetch tenants
    const mainConn = mongoose.connection;
    const tenants = await TenantRepo.model(mainConn).find({ status: 'active' }).lean();

    logger.info(`[Migration] Found ${tenants.length} active tenants`);

    const results = [];

    for (const tenant of tenants) {
      try {
        const tenantConn = await getConnection(tenant.slug);
        const result = await migrateTenant(tenantConn, tenant.slug);
        results.push(result);
      } catch (error) {
        logger.error(`[Migration] Failed to get connection for tenant: ${tenant.slug}`, {
          error: error.message
        });
        results.push({
          success: false,
          tenantSlug: tenant.slug,
          error: error.message
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    logger.info('[Migration] ✅ Migration completed', {
      total: tenants.length,
      successful,
      failed
    });

    return results;

  } catch (error) {
    logger.error('[Migration] ❌ Migration failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// CLI execution
if (require.main === module) {
  const command = process.argv[2];
  const tenantSlug = process.argv[3];

  (async () => {
    try {
      require('dotenv').config();
      await mongoose.connect(process.env.MONGODB_URI);

      if (command === 'migrate') {
        if (tenantSlug) {
          const { getConnection } = require('../../modules/connectionManager');
          const tenantConn = await getConnection(tenantSlug);
          await migrateTenant(tenantConn, tenantSlug);
        } else {
          await migrateAll();
        }
      } else if (command === 'rollback' && tenantSlug) {
        const { getConnection } = require('../../modules/connectionManager');
        const tenantConn = await getConnection(tenantSlug);
        await rollbackTenant(tenantConn, tenantSlug);
      } else {
        console.log('Usage:');
        console.log('  node 001-add-variation-support.js migrate [tenantSlug]');
        console.log('  node 001-add-variation-support.js rollback <tenantSlug>');
      }

      await mongoose.disconnect();
      process.exit(0);
    } catch (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
  })();
}

module.exports = { migrateTenant, rollbackTenant, migrateAll };

