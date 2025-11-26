// features/branch-menu/model/BranchMenu.schema.js
'use strict';

module.exports = (Schema) => {
  const BranchMenuSchema = new Schema(
    {
     

      branchId: {
        type: Schema.Types.ObjectId,
        ref: 'Branch',
        required: true,
        index: true,
      },

      menuItemId: {
        type: Schema.Types.ObjectId,
        ref: 'MenuItem',
        required: true,
        index: true,
      },

      // --- Branch-level overrides ---
      isAvailable: {
        type: Boolean,
        default: true,
      },

      isVisibleInPOS: {
        type: Boolean,
        default: true,
      },

      isVisibleInOnline: {
        type: Boolean,
        default: true,
      },

      sellingPrice: {
        type: Number,
        default: null, // null => use master menu basePrice
        min: 0,
      },

      priceIncludesTax: {
        type: Boolean,
        default: false,
      },

      displayOrder: {
        type: Number,
        default: 0,
        min: 0,
      },

      isFeatured: {
        type: Boolean,
        default: false,
      },

      isRecommended: {
        type: Boolean,
        default: false,
      },

      labels: [
        {
          type: String,
          trim: true,
        },
      ],

      metadata: {
        type: Schema.Types.Mixed,
      },

      menuItemNameSnapshot: {
        type: String,
        trim: true,
      },

      menuItemSlugSnapshot: {
        type: String,
        trim: true,
      },

      menuItemCodeSnapshot: {
        type: String,
        trim: true,
      },

      categoryId: {
        type: Schema.Types.ObjectId,
        ref: 'MenuCategory',
        index: true,
      },

      categoryNameSnapshot: {
        type: String,
        trim: true,
      },

      categorySlugSnapshot: {
        type: String,
        trim: true,
      },

      basePriceSnapshot: {
        type: Number,
        min: 0,
      },

      currencySnapshot: {
        type: String,
        trim: true,
      },

      taxModeSnapshot: {
        type: String,
        trim: true,
      },

      recipeIdSnapshot: {
        type: Schema.Types.ObjectId,
        ref: 'Recipe',
      },

      isActiveSnapshot: {
        type: Boolean,
        default: true,
      },
    },
    {
      timestamps: true,
    }
  );

  // A menu item can have only one config per branch
  BranchMenuSchema.index(
    { tenantId: 1, branchId: 1, menuItemId: 1 },
    { unique: true, name: 'uniq_branch_menu_item' }
  );

  // Useful for POS queries
  BranchMenuSchema.index({
    tenantId: 1,
    branchId: 1,
    categoryId: 1,
    displayOrder: 1,
  });

  BranchMenuSchema.index({
    tenantId: 1,
    branchId: 1,
    isAvailable: 1,
    isVisibleInPOS: 1,
  });

  return BranchMenuSchema;
};
