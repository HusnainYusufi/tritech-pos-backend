'use strict';

const axios = require('axios');
const AppError = require('../../../../modules/AppError');
const logger = require('../../../../modules/logger');
const BoomerangmeConfigRepo = require('../repository/boomerangmeConfig.repository');
const MenuItemRepo = require('../../../menu/repository/menuItem.repository');
const MenuCategoryRepo = require('../../../menu/repository/menuCategory.repository');
const PosOrderRepo = require('../../../pos/repository/posOrder.repository');

/**
 * BoomerangmeService
 * 
 * Handles all communication with Boomerangme loyalty platform.
 * 
 * Inbound: Validates credentials, returns inventory
 * Outbound: Triggers accruals, reversals
 * 
 * @see https://docs.boomerangme.cards/marketplace/create-an-application
 */
class BoomerangmeService {
  // ==================== CONFIGURATION ====================

  /**
   * Get current configuration
   */
  static async getConfig(conn) {
    const config = await BoomerangmeConfigRepo.getOrCreate(conn);
    // Strip sensitive fields for API response
    const sanitized = { ...config };
    if (sanitized.appToken) {
      sanitized.appToken = sanitized.appToken.substring(0, 8) + '***';
    }
    if (sanitized.webhookSecret) {
      sanitized.webhookSecret = '***';
    }
    return { status: 200, message: 'OK', result: sanitized };
  }

  /**
   * Update configuration
   */
  static async updateConfig(conn, payload) {
    const {
      isEnabled,
      appToken,
      credentials,
      webhookSecret,
      apiBaseUrl,
      metadata
    } = payload;

    const updateData = {};
    
    if (typeof isEnabled === 'boolean') updateData.isEnabled = isEnabled;
    if (appToken !== undefined) updateData.appToken = appToken;
    if (credentials !== undefined) updateData.credentials = credentials;
    if (webhookSecret !== undefined) updateData.webhookSecret = webhookSecret;
    if (apiBaseUrl !== undefined) updateData.apiBaseUrl = apiBaseUrl;
    if (metadata !== undefined) updateData.metadata = metadata;

    const config = await BoomerangmeConfigRepo.update(conn, updateData);
    
    logger.info('[BoomerangmeService] Config updated', { 
      isEnabled: config.isEnabled,
      hasAppToken: !!config.appToken,
      credentialsCount: config.credentials?.length || 0
    });

    return { status: 200, message: 'Configuration updated', result: config };
  }

  /**
   * Test connection to Boomerangme API
   */
  static async testConnection(conn) {
    const config = await BoomerangmeConfigRepo.get(conn);
    
    if (!config || !config.appToken) {
      throw new AppError('Boomerangme is not configured. Please set appToken first.', 400);
    }

    try {
      // Try to resolve our own credentials as a test
      const response = await axios.post(
        `${config.apiBaseUrl}/api/v2/marketplace/resolve-credentials`,
        {
          names: [],
          credentials: config.credentials || []
        },
        {
          headers: {
            'X-App-Token': config.appToken,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      logger.info('[BoomerangmeService] Connection test successful');
      
      return {
        status: 200,
        message: 'Connection successful',
        result: {
          connected: true,
          apiBaseUrl: config.apiBaseUrl,
          credentialsResolved: response.data?.credentials?.length || 0
        }
      };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      logger.error('[BoomerangmeService] Connection test failed', { error: errorMessage });
      
      await BoomerangmeConfigRepo.recordError(conn, errorMessage);
      
      return {
        status: 200,
        message: 'Connection failed',
        result: {
          connected: false,
          error: errorMessage
        }
      };
    }
  }

  // ==================== INBOUND (Boomerangme calls us) ====================

  /**
   * Validate credentials sent by Boomerangme during app installation
   * POST /check-credentials
   */
  static async checkCredentials(conn, credentials = []) {
    const isValid = await BoomerangmeConfigRepo.validateCredentials(conn, credentials);
    
    logger.info('[BoomerangmeService] Credentials check', { 
      isValid,
      credentialsCount: credentials.length 
    });

    return { isValid };
  }

  /**
   * Get inventory (menu) for Boomerangme
   * POST /get-inventory
   * 
   * Returns menu structure in Boomerangme format:
   * {
   *   inventoryItems: [
   *     { type: "group", id: "...", title: "...", items: [...] }
   *   ]
   * }
   */
  static async getInventory(conn, credentials = []) {
    // Validate credentials first
    const isValid = await BoomerangmeConfigRepo.validateCredentials(conn, credentials);
    if (!isValid) {
      throw new AppError('Invalid credentials', 401);
    }

    // Get all active categories
    const categoriesResult = await MenuCategoryRepo.search(conn, {
      isActive: true,
      page: 1,
      limit: 1000,
      sort: 'displayOrder',
      order: 'asc'
    });

    // Get all active menu items
    const itemsResult = await MenuItemRepo.search(conn, {
      isActive: true,
      page: 1,
      limit: 5000,
      sort: 'displayOrder',
      order: 'asc'
    });

    // Group items by category
    const itemsByCategory = new Map();
    for (const item of itemsResult.items || []) {
      const catId = item.categoryId?._id?.toString() || item.categoryId?.toString() || 'uncategorized';
      if (!itemsByCategory.has(catId)) {
        itemsByCategory.set(catId, []);
      }
      itemsByCategory.get(catId).push({
        type: 'item',
        id: item._id.toString(),
        title: item.name,
        price: item.pricing?.basePrice || 0,
        code: item.code || null
      });
    }

    // Build inventory structure
    const inventoryItems = [];

    for (const category of categoriesResult.items || []) {
      const catId = category._id.toString();
      const items = itemsByCategory.get(catId) || [];
      
      inventoryItems.push({
        type: 'group',
        id: catId,
        title: category.name,
        items
      });
    }

    // Add uncategorized items if any
    const uncategorized = itemsByCategory.get('uncategorized');
    if (uncategorized && uncategorized.length > 0) {
      inventoryItems.push({
        type: 'group',
        id: 'uncategorized',
        title: 'Other Items',
        items: uncategorized
      });
    }

    // Update sync time
    await BoomerangmeConfigRepo.updateInventorySyncTime(conn);

    logger.info('[BoomerangmeService] Inventory fetched', {
      categoriesCount: inventoryItems.length,
      totalItems: itemsResult.count
    });

    return { inventoryItems };
  }

  // ==================== OUTBOUND (We call Boomerangme) ====================

  /**
   * Trigger loyalty accrual for a completed order
   * Called via webhook when order is paid
   */
  static async accrueOrder(conn, { orderId, customerPhone, customerEmail }) {
    const config = await BoomerangmeConfigRepo.get(conn);
    
    if (!config || !config.isEnabled) {
      logger.debug('[BoomerangmeService] Accrual skipped - integration disabled');
      return { status: 200, message: 'Integration disabled', result: null };
    }

    if (!config.appToken) {
      throw new AppError('Boomerangme appToken not configured', 400);
    }

    // Fetch order details
    const PosOrder = PosOrderRepo.model(conn);
    const order = await PosOrder.findById(orderId).lean();
    
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Build accrual payload per Boomerangme API spec
    const accrualPayload = {
      check: {
        amount: order.totals?.grandTotal || 0,
        currency: order.pricingSnapshot?.currency || 'SAR',
        selections: (order.items || []).map(item => ({
          id: item.menuItemId?.toString() || '',
          groupId: item.categoryIdSnapshot?.toString() || '',
          displayName: item.nameSnapshot || 'Unknown Item',
          price: item.unitPrice || 0,
          quantity: item.quantity || 1,
          totalPrice: item.lineTotal || 0
        }))
      },
      phone: customerPhone || order.customerPhone || null,
      email: customerEmail || null,
      firstName: order.customerName?.split(' ')[0] || null,
      lastName: order.customerName?.split(' ').slice(1).join(' ') || null,
      transactionId: order._id.toString(),
      credentials: config.credentials || []
    };

    try {
      const response = await axios.post(
        `${config.apiBaseUrl}/api/v2/marketplace/accrue`,
        accrualPayload,
        {
          headers: {
            'X-App-Token': config.appToken,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      await BoomerangmeConfigRepo.incrementAccruals(conn);

      logger.info('[BoomerangmeService] Accrual successful', {
        orderId,
        transactionId: response.data?.transactionId,
        resultsCount: response.data?.results?.length || 0
      });

      return {
        status: 200,
        message: 'Loyalty accrual successful',
        result: response.data
      };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      logger.error('[BoomerangmeService] Accrual failed', {
        orderId,
        error: errorMessage
      });

      await BoomerangmeConfigRepo.recordError(conn, errorMessage);

      throw new AppError(`Boomerangme accrual failed: ${errorMessage}`, 502);
    }
  }

  /**
   * Reverse a previously accrued transaction (for refunds)
   */
  static async reverseOrder(conn, { orderId, transactionId }) {
    const config = await BoomerangmeConfigRepo.get(conn);
    
    if (!config || !config.isEnabled) {
      logger.debug('[BoomerangmeService] Reversal skipped - integration disabled');
      return { status: 200, message: 'Integration disabled', result: null };
    }

    if (!config.appToken) {
      throw new AppError('Boomerangme appToken not configured', 400);
    }

    // Use orderId as transactionId if not provided
    const txnId = transactionId || orderId;

    const reversePayload = {
      transactionId: txnId,
      credentials: config.credentials || []
    };

    try {
      const response = await axios.post(
        `${config.apiBaseUrl}/api/v2/marketplace/reverse`,
        reversePayload,
        {
          headers: {
            'X-App-Token': config.appToken,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      await BoomerangmeConfigRepo.incrementReversals(conn);

      logger.info('[BoomerangmeService] Reversal successful', {
        transactionId: txnId,
        resultsCount: response.data?.results?.length || 0
      });

      return {
        status: 200,
        message: 'Loyalty reversal successful',
        result: response.data
      };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      logger.error('[BoomerangmeService] Reversal failed', {
        transactionId: txnId,
        error: errorMessage
      });

      await BoomerangmeConfigRepo.recordError(conn, errorMessage);

      throw new AppError(`Boomerangme reversal failed: ${errorMessage}`, 502);
    }
  }

  // ==================== WEBHOOK HELPERS ====================

  /**
   * Validate webhook secret (optional security)
   */
  static async validateWebhookSecret(conn, providedSecret) {
    if (!providedSecret) return true; // No secret required if not set
    
    const config = await BoomerangmeConfigRepo.get(conn);
    if (!config?.webhookSecret) return true; // No secret configured
    
    return config.webhookSecret === providedSecret;
  }
}

module.exports = BoomerangmeService;
