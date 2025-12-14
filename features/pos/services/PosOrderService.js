// features/pos/services/PosOrderService.js
'use strict';

const AppError = require('../../../modules/AppError');
const logger = require('../../../modules/logger');
const InventoryHooks = require('../../../modules/inventoryHooks');
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
      notes,
      items = [],
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

    const pricedItems = await this._priceItems(conn, effectiveBranchId, items);

    const subTotal = pricedItems.reduce((acc, line) => acc + (line.lineTotal || 0), 0);
    const taxTotal = 0; // tax engine TBD
    const grandTotal = subTotal + taxTotal;

    const session = await conn.startSession();
    let orderDoc;
    try {
      await session.withTransaction(async () => {
        orderDoc = await PosOrderRepo.create(conn, {
          branchId: effectiveBranchId,
          posId: terminal?._id || posId || null,
          tillSessionId: normalizedTillSessionId,
          staffId: userDoc._id,
          status: 'placed',
          customerName: customerName || null,
          notes: notes || null,
          items: pricedItems,
          totals: { subTotal, taxTotal, grandTotal },
          pricingSnapshot: {
            currency: branchDoc.currency || 'SAR',
            priceIncludesTax: pricedItems.some((i) => i.priceIncludesTax),
            taxMode: branchDoc.tax?.mode || null,
          },
          createdBy: uid,
        }, { session });

        await InventoryHooks.deductStock(conn, tenantSlug, orderDoc, { session, actorId: uid, orderId: orderDoc._id });
      });
    } catch (err) {
      logger.error('[PosOrderService] Failed to place order', err);
      throw err;
    } finally {
      session.endSession();
    }

    return {
      status: 201,
      message: 'Order placed',
      result: {
        id: orderDoc._id,
        status: orderDoc.status,
        totals: orderDoc.totals,
        items: orderDoc.items,
        branchId: orderDoc.branchId,
        posId: orderDoc.posId,
      },
    };
  }

  static async _priceItems(conn, branchId, items) {
    if (!items || !items.length) throw new AppError('Order must include at least one item', 400);

    const menuItemIds = items.map((i) => i.menuItemId);
    const menuItems = await MenuItemRepo.findByIds(conn, menuItemIds);
    const menuMap = new Map(menuItems.map((m) => [String(m._id), m]));

    const configs = await BranchMenuRepo.listByBranchAndMenuItemIds(conn, branchId, menuItemIds);
    const configMap = new Map(configs.map((c) => [String(c.menuItemId), c]));

    return items.map((rawItem) => {
      const menuItem = menuMap.get(String(rawItem.menuItemId));
      if (!menuItem || menuItem.isDeleted || menuItem.isArchived || !menuItem.isActive) {
        throw new AppError('Menu item not available for sale', 404);
      }

      const config = configMap.get(String(rawItem.menuItemId));

      const unitPrice = (config?.sellingPrice ?? menuItem.pricing?.basePrice ?? 0);
      const qty = Number(rawItem.quantity) || 1;
      const lineTotal = unitPrice * qty;

      return {
        menuItemId: menuItem._id,
        recipeIdSnapshot: config?.recipeIdSnapshot || menuItem.recipeId || null,
        nameSnapshot: config?.menuItemNameSnapshot || menuItem.name,
        codeSnapshot: config?.menuItemCodeSnapshot || menuItem.code || null,
        categoryIdSnapshot: config?.categoryId || menuItem.categoryId || menuItem.category || null,
        quantity: qty,
        unitPrice,
        lineTotal,
        priceIncludesTax: config?.priceIncludesTax || menuItem.pricing?.priceIncludesTax || false,
        notes: rawItem.notes || null,
      };
    });
  }
}

module.exports = PosOrderService;
