// features/branch-menu/services/branchMenu.service.js
'use strict';

const AppError = require('../../../modules/AppError');
const BranchRepo = require('../../branch/repository/branch.repository');
const MenuItemRepo = require('../../menu/repository/menuItem.repository');
const BranchMenuRepo = require('../repository/branchMenu.repository');
const MenuVariationRepo = require('../../menu/repository/menuVariation.repository');
const AddOnGroupRepo = require('../../addons/repository/addOnGroup.repository');
const AddOnItemRepo = require('../../addons/repository/addOnItem.repository');

class BranchMenuService {
  /**
   * Upsert branch-level menu config for a given menuItemId + branchId
   */
  static async upsert(conn, payload) {
    const {
      branchId,
      menuItemId,
      isAvailable,
      isVisibleInPOS,
      isVisibleInOnline,
      sellingPrice,
      priceIncludesTax,
      displayOrder,
      isFeatured,
      isRecommended,
      labels,
      metadata,
    } = payload;

    if (!branchId || !menuItemId) {
      throw new AppError('branchId and menuItemId are required', 400);
    }

    const [branch, menuItem] = await Promise.all([
      BranchRepo.findById(conn, branchId),
      MenuItemRepo.findById(conn, menuItemId),
    ]);

    if (!branch || branch.isDeleted) {
      throw new AppError('Branch not found', 404);
    }

    if (!menuItem || menuItem.isDeleted || menuItem.isArchived || !menuItem.isActive) {
      throw new AppError('Menu item not found or inactive', 404);
    }

    const category = menuItem.categoryId || menuItem.category;

    const snapshot = {
      menuItemNameSnapshot: menuItem.name,
      menuItemSlugSnapshot: menuItem.slug,
      menuItemCodeSnapshot: menuItem.code,
      categoryId: category?._id || category || null,
      categoryNameSnapshot: category?.name || null,
      categorySlugSnapshot: category?.slug || null,
      basePriceSnapshot: menuItem.pricing?.basePrice ?? null,
      currencySnapshot: menuItem.pricing?.currency || 'SAR',
      taxModeSnapshot: menuItem.pricing?.taxMode || menuItem.taxMode || null,
      recipeIdSnapshot: menuItem.recipeId || null,
      isActiveSnapshot: !!menuItem.isActive,
    };

    const effectivePayload = {
      branchId,
      menuItemId,
      isAvailable: typeof isAvailable === 'boolean' ? isAvailable : true,
      isVisibleInPOS: typeof isVisibleInPOS === 'boolean' ? isVisibleInPOS : true,
      isVisibleInOnline: typeof isVisibleInOnline === 'boolean' ? isVisibleInOnline : true,
      sellingPrice: typeof sellingPrice === 'number' ? sellingPrice : sellingPrice === null ? null : null,
      priceIncludesTax:
        typeof priceIncludesTax === 'boolean'
          ? priceIncludesTax
          : menuItem.pricing?.priceIncludesTax || false,
      displayOrder: typeof displayOrder === 'number' ? displayOrder : 0,
      isFeatured: !!isFeatured,
      isRecommended: !!isRecommended,
      labels: Array.isArray(labels) ? labels : [],
      metadata: metadata || {},
      ...snapshot,
    };

    const existing = await BranchMenuRepo.findOneByBranchAndMenuItem(conn, branchId, menuItemId);
    let result;

    if (existing) {
      result = await BranchMenuRepo.updateById(conn, existing._id, effectivePayload);
    } else {
      result = await BranchMenuRepo.create(conn, effectivePayload);
    }

    return {
      status: 200,
      message: 'Branch menu configuration saved',
      result,
    };
  }

  /**
   * Raw list of branch menu configs (no merge with master menu).
   */
  static async list(conn, query) {
    const data = await BranchMenuRepo.search(conn, query);
    return {
      status: 200,
      message: 'Branch menu configurations fetched',
      result: data,
    };
  }
  static async updateById(conn, id, patch) {
    const existing = await BranchMenuRepo.findById(conn, id);
    if (!existing) throw new AppError('Branch menu config not found', 404);

    const { ifMatchVersion, refreshSnapshot, ...updates } = patch;

    if (typeof ifMatchVersion === 'number' && existing.__v !== ifMatchVersion) {
      throw new AppError('Branch menu configuration was updated elsewhere', 409);
    }

    // Do not change these
    delete updates.branchId;
    delete updates.menuItemId;

    let snapshot = {};

    if (refreshSnapshot) {
      const menuItem = await MenuItemRepo.findById(conn, existing.menuItemId);

      if (!menuItem || menuItem.isDeleted || menuItem.isArchived || !menuItem.isActive) {
        throw new AppError('Menu item not found or inactive', 404);
      }

      const category = menuItem.categoryId || menuItem.category;

      snapshot = {
        menuItemNameSnapshot: menuItem.name,
        menuItemSlugSnapshot: menuItem.slug,
        menuItemCodeSnapshot: menuItem.code,
        categoryId: category?._id || category || null,
        categoryNameSnapshot: category?.name || null,
        categorySlugSnapshot: category?.slug || null,
        basePriceSnapshot: menuItem.pricing?.basePrice ?? null,
        currencySnapshot: menuItem.pricing?.currency || 'SAR',
        taxModeSnapshot: menuItem.pricing?.taxMode || menuItem.taxMode || null,
        recipeIdSnapshot: menuItem.recipeId || null,
        isActiveSnapshot: !!menuItem.isActive,
      };
    }

    const updated = await BranchMenuRepo.updateById(
      conn,
      id,
      { ...updates, ...snapshot },
      ifMatchVersion
    );

    if (!updated) {
      throw new AppError('Branch menu configuration was updated elsewhere', 409);
    }

    return {
      status: 200,
      message: 'Branch menu configuration updated',
      result: updated,
    };
  }

  static async getById(conn, id) {
    const doc = await BranchMenuRepo.findById(conn, id);
    if (!doc) {
      throw new AppError('Branch menu config not found', 404);
    }

    return {
      status: 200,
      message: 'Branch menu configuration fetched',
      result: doc,
    };
  }

  static async delete(conn, id) {
    const doc = await BranchMenuRepo.deleteById(conn, id);
    if (!doc) {
      throw new AppError('Branch menu config not found', 404);
    }

    return {
      status: 200,
      message: 'Branch menu configuration deleted',
      result: doc,
    };
  }

  /**
   * Effective branch menu:
   * - Fetches all active menu items (master menu)
   * - Fetches branch configs
   * - Merges to return final effective menu for POS
   */
  static async listEffective(conn, query) {
    const {
      branchId,
      categoryId,
      q,
      page = 1,
      limit = 50,
    } = query || {};

    if (!branchId) {
      throw new AppError('branchId is required', 400);
    }

    const branch = await BranchRepo.findById(conn, branchId);

    if (!branch) {
      throw new AppError('Branch not found', 404);
    }

    const branchSnapshot = {
      id: branch._id,
      name: branch.name,
      code: branch.code,
      status: branch.status,
      address: branch.address || null,
      contact: branch.contact || null,
      currency: branch.currency,
      tax: branch.tax || null,
      timezone: branch.timezone,
      metadata: branch.metadata || {},
    };

    // 1) Get master menu items with existing service search
    const menuSearch = await MenuItemRepo.search(conn, {
      q,
      categoryId,
      isActive: true,
      page,
      limit,
    });

    const menuItems = menuSearch.items || [];

    if (!menuItems.length) {
      return {
        status: 200,
        message: 'No menu items found for this branch',
        result: {
          items: [],
          page: menuSearch.page,
          limit: menuSearch.limit,
          count: menuSearch.count,
        },
      };
    }

    const menuItemIds = menuItems.map((m) => m._id);

    // Fetch branch configs + variation/add-on definitions in parallel to keep the POS payload rich
    const [configs, menuVariations] = await Promise.all([
      BranchMenuRepo.listByBranchAndMenuItemIds(conn, branchId, menuItemIds),
      MenuVariationRepo.model(conn)
        .find({ menuItemId: { $in: menuItemIds }, isActive: true })
        .sort({ displayOrder: 1, name: 1 })
        .lean(),
    ]);

    // Build variation map keyed by menuItemId for quick lookup
    const variationMap = new Map();
    for (const v of menuVariations) {
      const key = String(v.menuItemId);
      if (!variationMap.has(key)) variationMap.set(key, []);
      variationMap.get(key).push({
        id: v._id,
        menuItemId: v.menuItemId,
        recipeVariantId: v.recipeVariantId || null,
        name: v.name,
        type: v.type,
        priceDelta: v.priceDelta || 0,
        sizeMultiplier: v.sizeMultiplier || 1,
        costDelta: v.costDelta || 0,
        calculatedCost: v.calculatedCost || 0,
        crustType: v.crustType || '',
        flavorTag: v.flavorTag || '',
        ingredients: v.ingredients || [],
        isDefault: !!v.isDefault,
        isActive: v.isActive !== false,
        displayOrder: v.displayOrder || 0,
        metadata: v.metadata || {},
      });
    }

    // Fetch add-on groups/items per category (category-based assignment is how the system currently links add-ons)
    const categoryIds = menuItems
      .map((m) => m.categoryId?._id || m.categoryId || null)
      .filter(Boolean);

    let addOnGroups = [];
    let addOnItems = [];

    if (categoryIds.length) {
      addOnGroups = await AddOnGroupRepo.model(conn)
        .find({ categoryId: { $in: categoryIds }, isActive: true })
        .sort({ displayOrder: 1, name: 1 })
        .lean();

      const addOnGroupIds = addOnGroups.map((g) => g._id);
      if (addOnGroupIds.length) {
        addOnItems = await AddOnItemRepo.model(conn)
          .find({ groupId: { $in: addOnGroupIds }, isActive: true })
          .sort({ displayOrder: 1, nameSnapshot: 1 })
          .lean();
      }
    }

    // Map add-on items into their groups, and groups by category for quick attachment
    const addOnItemsByGroup = new Map();
    for (const item of addOnItems) {
      const key = String(item.groupId);
      if (!addOnItemsByGroup.has(key)) addOnItemsByGroup.set(key, []);
      addOnItemsByGroup.get(key).push({
        id: item._id,
        groupId: item.groupId,
        categoryId: item.categoryId,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        name: item.nameSnapshot,
        price: item.price || 0,
        unit: item.unit || 'unit',
        isRequired: !!item.isRequired,
        isActive: item.isActive !== false,
        displayOrder: item.displayOrder || 0,
        metadata: item.metadata || {},
      });
    }

    const addOnGroupsByCategory = new Map();
    for (const g of addOnGroups) {
      const catKey = String(g.categoryId);
      if (!addOnGroupsByCategory.has(catKey)) addOnGroupsByCategory.set(catKey, []);
      const groupItems = addOnItemsByGroup.get(String(g._id)) || [];
      addOnGroupsByCategory.get(catKey).push({
        id: g._id,
        categoryId: g.categoryId,
        name: g.name,
        description: g.description || '',
        isActive: g.isActive !== false,
        displayOrder: g.displayOrder || 0,
        metadata: g.metadata || {},
        items: groupItems,
      });
    }

    const configMap = new Map(
      configs.map((c) => [String(c.menuItemId), c])
    );

    const items = menuItems.map((m) => {
      const cfg = configMap.get(String(m._id)) || null;

      const masterBasePrice = m.pricing?.basePrice ?? null;
      const masterPriceIncludesTax = m.pricing?.priceIncludesTax ?? false;

      // If there is no branch config, treat the item as NOT assigned to this branch.
      const hasCfg = !!cfg;

      const effectivePrice =
        hasCfg && cfg.sellingPrice !== null && typeof cfg.sellingPrice === 'number'
          ? cfg.sellingPrice
          : masterBasePrice;

      const effectivePriceIncludesTax =
        hasCfg && typeof cfg.priceIncludesTax === 'boolean'
          ? cfg.priceIncludesTax
          : masterPriceIncludesTax;

      const effectiveIsAvailable =
        hasCfg && typeof cfg.isAvailable === 'boolean'
          ? cfg.isAvailable
          : false; // unassigned items are NOT available

      const effectiveIsVisibleInPOS =
        hasCfg && typeof cfg.isVisibleInPOS === 'boolean'
          ? cfg.isVisibleInPOS
          : false; // unassigned items are NOT visible in POS

      const effectiveIsVisibleInOnline =
        hasCfg && typeof cfg.isVisibleInOnline === 'boolean'
          ? cfg.isVisibleInOnline
          : false;

      const effectiveDisplayOrder =
        hasCfg && typeof cfg.displayOrder === 'number'
          ? cfg.displayOrder
          : m.displayOrder || 0;

      const variationsForItem = variationMap.get(String(m._id)) || [];
      const addOnsForItem =
        addOnGroupsByCategory.get(String(m.categoryId?._id || m.categoryId || '')) || [];

      return {
        branchId,
        branch: branchSnapshot,
        menuItemId: m._id,
        menuItem: {
          id: m._id,
          name: m.name,
          slug: m.slug,
          code: m.code,
          description: m.description,
          category: m.categoryId || null,
          pricing: m.pricing || {},
          isActive: m.isActive,
        },
        branchConfig: cfg,
        variations: variationsForItem,
        addOns: addOnsForItem,
        effective: {
          price: effectivePrice,
          priceIncludesTax: effectivePriceIncludesTax,
          isAvailable: effectiveIsAvailable,
          isVisibleInPOS: effectiveIsVisibleInPOS,
          isVisibleInOnline: effectiveIsVisibleInOnline,
          displayOrder: effectiveDisplayOrder,
        },
      };
    });

    return {
      status: 200,
      message: 'Effective branch menu fetched',
      result: {
        branch: branchSnapshot,
        items,
        page: menuSearch.page,
        limit: menuSearch.limit,
        // Count only items effectively available/visible for this branch (assigned)
        count: items.length,
      },
    };
  }
}

module.exports = BranchMenuService;
