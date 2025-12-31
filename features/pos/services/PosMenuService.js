// features/pos/services/PosMenuService.js
'use strict';

const AppError = require('../../../modules/AppError');
const BranchMenuService = require('../../branch-menu/services/branchMenu.service');
const TenantUserRepo = require('../../tenant-auth/repository/tenantUser.repository');
const { branchGuard } = require('../../tenant-auth/services/tenantGuards');

class PosMenuService {
  static async list(conn, userContext, query = {}) {
    const {
      branchId,
      categoryId,
      q,
      page,
      limit,
      includeUnavailable,
      includeHidden,
    } = query;

    // Coerce boolean-ish query params (because validate middleware does not mutate req.query)
    const includeUnavailableFlag = includeUnavailable === true || includeUnavailable === 'true';
    const includeHiddenFlag = includeHidden === true || includeHidden === 'true';

    const uid = userContext?.uid;
    if (!uid) throw new AppError('Unauthorized', 401);

    const User = TenantUserRepo.model(conn);
    const userDoc = await User.findById(uid);
    if (!userDoc) throw new AppError('User not found', 404);
    if (userDoc.status !== 'active') throw new AppError('Account is not active', 403);

    const effectiveBranchId = branchId || userContext.branchId || null;
    if (!effectiveBranchId) throw new AppError('branchId is required to fetch POS menu', 400);
    branchGuard(userDoc, effectiveBranchId);

    const response = await BranchMenuService.listEffective(conn, {
      branchId: effectiveBranchId,
      categoryId,
      q,
      page,
      limit,
    });

    const { result } = response;
    const rawItems = result?.items || [];

    const filteredItems = rawItems.filter((item) => {
      const isVisible = item?.effective?.isVisibleInPOS !== false;
      const isAvailable = item?.effective?.isAvailable !== false;
      return (includeHiddenFlag || isVisible) && (includeUnavailableFlag || isAvailable);
    });

    const simplifiedItems = filteredItems.map((item) => {
      const categoryRef = item.menuItem?.category || item.branchConfig?.categoryId || null;
      const categoryIdValue = categoryRef?._id || categoryRef?.id || categoryRef || null;
      const categoryName = categoryRef?.name || item.branchConfig?.categoryNameSnapshot || null;
      const categorySlug = categoryRef?.slug || item.branchConfig?.categorySlugSnapshot || null;

      const variations = (item.variations || [])
        .filter((v) => v && v.isActive !== false)
        .sort((a, b) => {
          if ((a.displayOrder || 0) !== (b.displayOrder || 0)) {
            return (a.displayOrder || 0) - (b.displayOrder || 0);
          }
          return (a.name || '').localeCompare(b.name || '');
        })
        .map((v) => ({
          id: v.id || v._id,
          name: v.name,
          type: v.type,
          priceDelta: v.priceDelta || 0,
          sizeMultiplier: v.sizeMultiplier || 1,
          recipeVariantId: v.recipeVariantId || null,
          isDefault: !!v.isDefault,
          displayOrder: v.displayOrder || 0,
          metadata: v.metadata || {},
        }));

      const addOnGroups = (item.addOns || [])
        .filter((g) => g && g.isActive !== false)
        .sort((a, b) => {
          if ((a.displayOrder || 0) !== (b.displayOrder || 0)) {
            return (a.displayOrder || 0) - (b.displayOrder || 0);
          }
          return (a.name || '').localeCompare(b.name || '');
        })
        .map((g) => {
          const groupItems = (g.items || [])
            .filter((ai) => ai && ai.isActive !== false)
            .sort((a, b) => {
              if ((a.displayOrder || 0) !== (b.displayOrder || 0)) {
                return (a.displayOrder || 0) - (b.displayOrder || 0);
              }
              return (a.name || '').localeCompare(b.name || '');
            })
            .map((ai) => ({
              id: ai.id || ai._id,
              name: ai.name,
              price: ai.price || 0,
              unit: ai.unit || 'unit',
              isRequired: !!ai.isRequired,
              displayOrder: ai.displayOrder || 0,
              metadata: ai.metadata || {},
            }));

          return {
            id: g.id || g._id,
            name: g.name,
            description: g.description || '',
            displayOrder: g.displayOrder || 0,
            items: groupItems,
            metadata: g.metadata || {},
          };
        });

      return {
        id: item.menuItemId,
        name: item.menuItem?.name || item.branchConfig?.menuItemNameSnapshot || null,
        slug: item.menuItem?.slug || item.branchConfig?.menuItemSlugSnapshot || null,
        code: item.menuItem?.code || item.branchConfig?.menuItemCodeSnapshot || null,
        description: item.menuItem?.description || null,
        categoryId: categoryIdValue,
        categoryName,
        categorySlug,
        price: item.effective?.price ?? null,
        priceIncludesTax: !!item.effective?.priceIncludesTax,
        isAvailable: item.effective?.isAvailable !== false,
        isVisibleInPOS: item.effective?.isVisibleInPOS !== false,
        displayOrder: item.effective?.displayOrder ?? 0,
        labels: item.branchConfig?.labels || [],
        metadata: item.branchConfig?.metadata || {},
        variations,
        addOns: addOnGroups,
      };
    });

    const categoryMap = new Map();

    for (const item of simplifiedItems) {
      const categoryKey = item.categoryId || `uncategorized:${item.categoryName || 'uncategorized'}`;
      if (!categoryMap.has(categoryKey)) {
        categoryMap.set(categoryKey, {
          id: item.categoryId || null,
          name: item.categoryName || null,
          slug: item.categorySlug || null,
          displayOrder: item.displayOrder || 0,
          items: [],
        });
      }
      categoryMap.get(categoryKey).items.push(item);
    }

    const categories = Array.from(categoryMap.values()).map((cat) => {
      const sortedItems = cat.items.sort((a, b) => {
        if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
        return (a.name || '').localeCompare(b.name || '');
      });
      const firstDisplayOrder = sortedItems.length ? sortedItems[0].displayOrder : cat.displayOrder;
      return {
        ...cat,
        displayOrder: firstDisplayOrder,
        items: sortedItems,
      };
    }).sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
      return (a.name || '').localeCompare(b.name || '');
    });

    const sortedItems = simplifiedItems.sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
      return (a.name || '').localeCompare(b.name || '');
    });

    return {
      status: 200,
      message: 'POS menu fetched',
      result: {
        branch: result?.branch || null,
        categories,
        items: sortedItems,
        page: result?.page,
        limit: result?.limit,
        total: result?.count ?? sortedItems.length,
        count: sortedItems.length,
      },
    };
  }
}

module.exports = PosMenuService;
