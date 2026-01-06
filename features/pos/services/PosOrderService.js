// features/pos/services/PosOrderService.js
'use strict';

const AppError = require('../../../modules/AppError');
const logger = require('../../../modules/logger');
const InventoryHooks = require('../../../modules/inventoryHooks');
const { generateNextOrderNumber } = require('../../../modules/orderNumber');
const BranchMenuRepo = require('../../branch-menu/repository/branchMenu.repository');
const BranchRepo = require('../../branch/repository/branch.repository');
const MenuItemRepo = require('../../menu/repository/menuItem.repository');
const PosTerminalService = require('./PosTerminalService');
const PosOrderRepo = require('../repository/posOrder.repository');
const TenantUserRepo = require('../../tenant-auth/repository/tenantUser.repository');
const TillSessionRepo = require('../../tenant-auth/repository/tillSession.repository');
const { branchGuard, hasTenantScope } = require('../../tenant-auth/services/tenantGuards');

class PosOrderService {
  static async create(conn, tenantSlug, userContext, payload) {
    const {
      branchId,
      posId,
      tillSessionId,
      customerName,
      customerPhone,
      notes,
      items = [],
      paymentMethod = 'cash',
      amountPaid = 0,
    } = payload || {};

    const uid = userContext?.uid;
    if (!uid) throw new AppError('Unauthorized', 401);

    const User = TenantUserRepo.model(conn);
    const userDoc = await User.findById(uid);
    if (!userDoc) throw new AppError('User not found', 404);
    if (userDoc.status !== 'active') throw new AppError('Account is not active', 403);
    if (!userDoc.isStaff && !hasTenantScope(userDoc)) {
      throw new AppError('Only staff members can place orders', 403);
    }

    let effectiveBranchId = branchId || userContext.branchId || null;
    if (!effectiveBranchId) {
      const branches = (userDoc.branchIds || []).map(String);
      if (branches.length === 1) effectiveBranchId = branches[0];
    }

    if (!effectiveBranchId) throw new AppError('branchId is required for POS orders', 400);

    branchGuard(userDoc, effectiveBranchId);

    const [branchDoc, terminal] = await Promise.all([
      BranchRepo.findById(conn, effectiveBranchId),
      PosTerminalService.getActiveInBranch(conn, effectiveBranchId, posId || userContext.posId || null),
    ]);

    if (!branchDoc || branchDoc.isDeleted) throw new AppError('Branch not found', 404);

    const normalizedTillSessionId = tillSessionId || userContext.tillSessionId || null;
    if (!normalizedTillSessionId) {
      const openSession = await TillSessionRepo.findOpenByStaffBranchPos(
        conn,
        uid,
        effectiveBranchId,
        posId || userContext.posId || null,
      );
      if (!openSession) {
        throw new AppError('No open till session for this cashier/terminal', 403);
      }
    }

    // Price items
    const pricedItems = await this._priceItems(conn, effectiveBranchId, items);

    // Calculate totals with payment-method-based tax override
    const subTotal = pricedItems.reduce((acc, line) => acc + (line.lineTotal || 0), 0);

    // Payment method specific tax rules (check branch config first, then fallback to hardcoded)
    let effectiveTaxRate = branchDoc.tax?.rate || 0;
    
    if (paymentMethod && branchDoc.posConfig?.paymentMethods) {
      const methodConfig = branchDoc.posConfig.paymentMethods[paymentMethod];
      if (methodConfig?.taxRateOverride !== null && methodConfig?.taxRateOverride !== undefined) {
        effectiveTaxRate = methodConfig.taxRateOverride;
      }
    }

    const effectiveTaxMode = branchDoc.tax?.mode || 'exclusive';
    const taxTotal = effectiveTaxMode === 'exclusive'
      ? (subTotal * effectiveTaxRate / 100)
      : 0; // leaving inclusive behavior unchanged
    const discount = 0; // TODO: Add discount logic
    const grandTotal = subTotal + taxTotal - discount;

    // Generate order number
    const orderPrefix = branchDoc.posConfig?.orderPrefix || 'ORD';
    const orderNumber = await generateNextOrderNumber(conn, effectiveBranchId, orderPrefix);

    // Determine order status and payment (support optional payment for payLater mode)
    const hasPayment = amountPaid > 0;
    const isPaid = hasPayment && amountPaid >= grandTotal;
    const orderStatus = isPaid ? 'paid' : 'placed';
    const change = isPaid ? Math.max(0, amountPaid - grandTotal) : 0;

    // Create order
    const orderDoc = await PosOrderRepo.create(conn, {
      orderNumber,
      branchId: effectiveBranchId,
      posId: terminal?._id || posId || null,
      tillSessionId: normalizedTillSessionId,
      staffId: userDoc._id,
      status: orderStatus,
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      notes: notes || null,
      items: pricedItems,
      totals: { subTotal, taxTotal, discount, grandTotal },
      payment: {
        method: paymentMethod,
        amountPaid: isPaid ? amountPaid : 0,
        change,
        paidAt: isPaid ? new Date() : null,
      },
      pricingSnapshot: {
        currency: branchDoc.currency || 'SAR',
        priceIncludesTax: pricedItems.some((i) => i.priceIncludesTax),
        taxMode: effectiveTaxMode,
        taxRate: effectiveTaxRate,
      },
      createdBy: uid,
    });

    // Deduct inventory
    try {
      await InventoryHooks.deductStock(conn, tenantSlug, orderDoc);
    } catch (err) {
      logger.error('[PosOrderService] inventory deduction failed', err);
      // Don't fail the order, just log the error
    }

    logger.info('[PosOrderService] Order created successfully', {
      orderNumber: orderDoc.orderNumber,
      orderId: orderDoc._id,
      branchId: effectiveBranchId,
      staffId: uid,
      grandTotal,
      status: orderStatus
    });

    return {
      status: 201,
      message: isPaid ? 'Order placed and paid' : 'Order placed',
      result: {
        id: orderDoc._id,
        orderNumber: orderDoc.orderNumber,
        status: orderDoc.status,
        totals: orderDoc.totals,
        payment: orderDoc.payment,
        items: orderDoc.items,
        branchId: orderDoc.branchId,
        posId: orderDoc.posId,
        createdAt: orderDoc.createdAt,
      },
    };
  }

  /**
   * Price order items with variation support
   * 
   * ✅ PRODUCTION FIX: Now properly handles variations for accurate pricing and cost tracking
   * 
   * @param {Object} conn - Tenant database connection
   * @param {String} branchId - Branch ID
   * @param {Array} items - Order items with optional variations
   * @returns {Promise<Array>} Priced items with variations
   */
  static async _priceItems(conn, branchId, items) {
    if (!items || !items.length) throw new AppError('Order must include at least one item', 400);

    const MenuVariationRepo = require('../../menu/repository/menuVariation.repository');
    const MenuCostCalculator = require('../../menu/services/menuCostCalculator.service');

    const menuItemIds = items.map((i) => i.menuItemId);
    const menuItems = await MenuItemRepo.findByIds(conn, menuItemIds);
    const menuMap = new Map(menuItems.map((m) => [String(m._id), m]));

    const configs = await BranchMenuRepo.listByBranchAndMenuItemIds(conn, branchId, menuItemIds);
    const configMap = new Map(configs.map((c) => [String(c.menuItemId), c]));

    const pricedItems = [];

    for (const rawItem of items) {
      const menuItem = menuMap.get(String(rawItem.menuItemId));
      if (!menuItem || menuItem.isDeleted || menuItem.isArchived || !menuItem.isActive) {
        throw new AppError(`Menu item not available for sale: ${rawItem.menuItemId}`, 404);
      }

      const config = configMap.get(String(rawItem.menuItemId));
      let unitPrice = (config?.sellingPrice ?? menuItem.pricing?.basePrice ?? 0);
      
      // ✅ CRITICAL FIX: Process selected variations
      const selectedVariations = [];
      if (rawItem.variations && Array.isArray(rawItem.variations) && rawItem.variations.length > 0) {
        // Load variation details
        const variations = await MenuVariationRepo.model(conn)
          .find({ _id: { $in: rawItem.variations } })
          .lean();

        for (const variation of variations) {
          // Validate variation belongs to this menu item
          if (String(variation.menuItemId) !== String(rawItem.menuItemId)) {
            throw new AppError(
              `Variation "${variation.name}" does not belong to menu item`,
              400
            );
          }

          // Add price delta
          unitPrice += (variation.priceDelta || 0);

          // Capture variation details for order
          selectedVariations.push({
            menuVariationId: variation._id,
            recipeVariantId: variation.recipeVariantId || null,
            nameSnapshot: variation.name,
            type: variation.type,
            priceDelta: variation.priceDelta || 0,
            sizeMultiplier: variation.sizeMultiplier || 1,
            calculatedCost: variation.calculatedCost || 0
          });
        }
      }

      const qty = Number(rawItem.quantity) || 1;
      const lineTotal = unitPrice * qty;

      // ✅ NEW: Calculate actual cost for profit tracking
      let calculatedCost = 0;
      try {
        const costData = await MenuCostCalculator.calculateOrderItemCost(
          conn,
          rawItem.menuItemId,
          rawItem.variations || []
        );
        calculatedCost = costData.totalCost * qty;
      } catch (error) {
        logger.error('[PosOrderService] Cost calculation failed', {
          menuItemId: rawItem.menuItemId,
          error: error.message
        });
        // Don't fail the order, just log the error
      }

      pricedItems.push({
        menuItemId: menuItem._id,
        recipeIdSnapshot: config?.recipeIdSnapshot || menuItem.recipeId || null,
        selectedVariations, // ✅ NEW: Captured variations
        nameSnapshot: config?.menuItemNameSnapshot || menuItem.name,
        codeSnapshot: config?.menuItemCodeSnapshot || menuItem.code || null,
        categoryIdSnapshot: config?.categoryId || menuItem.categoryId || menuItem.category || null,
        quantity: qty,
        unitPrice,
        lineTotal,
        calculatedCost, // ✅ NEW: Actual cost for reporting
        priceIncludesTax: config?.priceIncludesTax || menuItem.pricing?.priceIncludesTax || false,
        notes: rawItem.notes || null,
      });
    }

    return pricedItems;
  }
}

module.exports = PosOrderService;
