// features/branch/services/BranchConfigService.js
'use strict';

const AppError = require('../../../modules/AppError');
const logger = require('../../../modules/logger');
const BranchRepo = require('../repository/branch.repository');

/**
 * Branch POS Configuration Service
 * Manages branch-level POS behavior and receipt settings
 */
class BranchConfigService {
  /**
   * Get POS configuration for a branch
   * @param {Connection} conn - Tenant database connection
   * @param {string} branchId - Branch ID
   * @returns {Promise<Object>} POS configuration
   */
  static async getPosConfig(conn, branchId) {
    const branch = await BranchRepo.findById(conn, branchId);
    
    if (!branch || branch.isDeleted) {
      throw new AppError('Branch not found', 404);
    }

    // Return posConfig with defaults if not set
    const posConfig = branch.posConfig || {};
    
    return {
      status: 200,
      message: 'POS configuration retrieved successfully',
      result: {
        branchId: branch._id,
        branchName: branch.name,
        currency: branch.currency || 'PKR',
        timezone: branch.timezone || 'Asia/Karachi',
        tax: {
          mode: branch.tax?.mode || 'exclusive',
          rate: branch.tax?.rate || 0,
          vatNumber: branch.tax?.vatNumber || ''
        },
        posConfig: {
          orderPrefix: posConfig.orderPrefix || 'ORD',
          receiptFooter: posConfig.receiptFooter || '',
          enableHoldOrders: posConfig.enableHoldOrders !== false,
          enableTableService: posConfig.enableTableService || false,
          paymentMode: posConfig.paymentMode || 'payNow',
          receiptConfig: {
            showLogo: posConfig.receiptConfig?.showLogo || false,
            logoUrl: posConfig.receiptConfig?.logoUrl || '',
            showQRCode: posConfig.receiptConfig?.showQRCode || false,
            qrCodeData: posConfig.receiptConfig?.qrCodeData || '',
            headerText: posConfig.receiptConfig?.headerText || '',
            footerText: posConfig.receiptConfig?.footerText || 'Thank you for your business!',
            showTaxBreakdown: posConfig.receiptConfig?.showTaxBreakdown !== false,
            showItemCodes: posConfig.receiptConfig?.showItemCodes || false,
            paperWidth: posConfig.receiptConfig?.paperWidth || 80,
            fontSizeMultiplier: posConfig.receiptConfig?.fontSizeMultiplier || 1.0
          },
          paymentMethods: {
            cash: {
              enabled: posConfig.paymentMethods?.cash?.enabled !== false,
              taxRateOverride: posConfig.paymentMethods?.cash?.taxRateOverride || null
            },
            card: {
              enabled: posConfig.paymentMethods?.card?.enabled !== false,
              taxRateOverride: posConfig.paymentMethods?.card?.taxRateOverride || null,
              minAmount: posConfig.paymentMethods?.card?.minAmount || 0
            },
            mobile: {
              enabled: posConfig.paymentMethods?.mobile?.enabled !== false,
              taxRateOverride: posConfig.paymentMethods?.mobile?.taxRateOverride || null
            }
          }
        }
      }
    };
  }

  /**
   * Update POS configuration for a branch
   * @param {Connection} conn - Tenant database connection
   * @param {string} branchId - Branch ID
   * @param {Object} configData - Configuration data to update
   * @returns {Promise<Object>} Updated configuration
   */
  static async updatePosConfig(conn, branchId, configData) {
    const branch = await BranchRepo.findById(conn, branchId);
    
    if (!branch || branch.isDeleted) {
      throw new AppError('Branch not found', 404);
    }

    // Build update object
    const updateData = {};
    
    if (configData.orderPrefix !== undefined) {
      updateData['posConfig.orderPrefix'] = configData.orderPrefix;
    }
    if (configData.receiptFooter !== undefined) {
      updateData['posConfig.receiptFooter'] = configData.receiptFooter;
    }
    if (configData.enableHoldOrders !== undefined) {
      updateData['posConfig.enableHoldOrders'] = configData.enableHoldOrders;
    }
    if (configData.enableTableService !== undefined) {
      updateData['posConfig.enableTableService'] = configData.enableTableService;
    }
    if (configData.paymentMode !== undefined) {
      updateData['posConfig.paymentMode'] = configData.paymentMode;
    }

    // Receipt config updates
    if (configData.receiptConfig) {
      const rc = configData.receiptConfig;
      if (rc.showLogo !== undefined) updateData['posConfig.receiptConfig.showLogo'] = rc.showLogo;
      if (rc.logoUrl !== undefined) updateData['posConfig.receiptConfig.logoUrl'] = rc.logoUrl;
      if (rc.showQRCode !== undefined) updateData['posConfig.receiptConfig.showQRCode'] = rc.showQRCode;
      if (rc.qrCodeData !== undefined) updateData['posConfig.receiptConfig.qrCodeData'] = rc.qrCodeData;
      if (rc.headerText !== undefined) updateData['posConfig.receiptConfig.headerText'] = rc.headerText;
      if (rc.footerText !== undefined) updateData['posConfig.receiptConfig.footerText'] = rc.footerText;
      if (rc.showTaxBreakdown !== undefined) updateData['posConfig.receiptConfig.showTaxBreakdown'] = rc.showTaxBreakdown;
      if (rc.showItemCodes !== undefined) updateData['posConfig.receiptConfig.showItemCodes'] = rc.showItemCodes;
      if (rc.paperWidth !== undefined) updateData['posConfig.receiptConfig.paperWidth'] = rc.paperWidth;
      if (rc.fontSizeMultiplier !== undefined) updateData['posConfig.receiptConfig.fontSizeMultiplier'] = rc.fontSizeMultiplier;
    }

    // Payment methods updates
    if (configData.paymentMethods) {
      const pm = configData.paymentMethods;
      
      if (pm.cash) {
        if (pm.cash.enabled !== undefined) updateData['posConfig.paymentMethods.cash.enabled'] = pm.cash.enabled;
        if (pm.cash.taxRateOverride !== undefined) updateData['posConfig.paymentMethods.cash.taxRateOverride'] = pm.cash.taxRateOverride;
      }
      
      if (pm.card) {
        if (pm.card.enabled !== undefined) updateData['posConfig.paymentMethods.card.enabled'] = pm.card.enabled;
        if (pm.card.taxRateOverride !== undefined) updateData['posConfig.paymentMethods.card.taxRateOverride'] = pm.card.taxRateOverride;
        if (pm.card.minAmount !== undefined) updateData['posConfig.paymentMethods.card.minAmount'] = pm.card.minAmount;
      }
      
      if (pm.mobile) {
        if (pm.mobile.enabled !== undefined) updateData['posConfig.paymentMethods.mobile.enabled'] = pm.mobile.enabled;
        if (pm.mobile.taxRateOverride !== undefined) updateData['posConfig.paymentMethods.mobile.taxRateOverride'] = pm.mobile.taxRateOverride;
      }
    }

    // Update branch
    const Branch = BranchRepo.model(conn);
    await Branch.findByIdAndUpdate(branchId, { $set: updateData }, { new: true });

    logger.info(`POS config updated for branch ${branchId}`);

    // Return updated config
    return this.getPosConfig(conn, branchId);
  }

  /**
   * Get lightweight POS config for ME API (after login)
   * @param {Connection} conn - Tenant database connection
   * @param {string} branchId - Branch ID
   * @returns {Promise<Object>} Lightweight config for frontend
   */
  static async getPosConfigForAuth(conn, branchId) {
    if (!branchId) {
      return null;
    }

    try {
      const branch = await BranchRepo.findById(conn, branchId);
      
      if (!branch || branch.isDeleted) {
        return null;
      }

      const posConfig = branch.posConfig || {};

      return {
        branchId: branch._id,
        branchName: branch.name,
        currency: branch.currency || 'PKR',
        paymentMode: posConfig.paymentMode || 'payNow',
        enableTableService: posConfig.enableTableService || false,
        receiptConfig: {
          showLogo: posConfig.receiptConfig?.showLogo || false,
          logoUrl: posConfig.receiptConfig?.logoUrl || '',
          footerText: posConfig.receiptConfig?.footerText || 'Thank you for your business!'
        },
        paymentMethods: {
          cash: { enabled: posConfig.paymentMethods?.cash?.enabled !== false },
          card: { enabled: posConfig.paymentMethods?.card?.enabled !== false },
          mobile: { enabled: posConfig.paymentMethods?.mobile?.enabled !== false }
        }
      };
    } catch (err) {
      logger.error('Failed to get POS config for auth', err);
      return null;
    }
  }
}

module.exports = BranchConfigService;

