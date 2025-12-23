'use strict';

module.exports = (Schema) => {
  const VariationIngredientSchema = new Schema({
    sourceType: { type: String, enum: ['inventory','recipe'], required: true },
    sourceId: { type: Schema.Types.ObjectId, required: true, index: true },
    nameSnapshot: { type: String, default: '' },
    quantity: { type: Number, default: 0 },  // extra/override quantity in item's recipe units
    unit: { type: String, default: '' }      // unit label (e.g., g, ml, unit)
  }, { _id: false });

  const MenuVariationSchema = new Schema({
    menuItemId: { type: Schema.Types.ObjectId, ref: 'MenuItem', required: true, index: true },

    // ✅ CRITICAL FIX: Link to RecipeVariant for proper cost calculation and inventory deduction
    recipeVariantId: { 
      type: Schema.Types.ObjectId, 
      ref: 'RecipeVariant', 
      default: null,
      index: true 
    },

    name: { type: String, required: true, trim: true, maxlength: 160 },  // e.g., "Large", "Stuffed Crust", "Extra Cheese"
    type: { type: String, enum: ['size','crust','flavor','addon','combo','custom'], default: 'custom' },

    // Pricing behavior
    priceDelta: { type: Number, default: 0 },          // +/− to base price
    costDelta: { type: Number, default: 0 },           // optional for COGS reporting (deprecated, use calculatedCost)
    sizeMultiplier: { type: Number, default: 1 },      // scale all recipe ingredient usage (legacy, prefer recipeVariant)

    // ✅ NEW: Calculated cost for reporting and profit margin tracking
    calculatedCost: { type: Number, default: 0 },      // auto-calculated from recipeVariant or ingredients

    // Optional specificity (UX friendly)
    crustType: { type: String, default: '' },
    flavorTag: { type: String, default: '' },

    // Per-variation ingredient overrides/additions (legacy, prefer recipeVariantId)
    ingredients: { type: [VariationIngredientSchema], default: [] },

    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },

    metadata: { type: Object, default: {} },
  }, { timestamps: true });

  // ✅ CRITICAL: Ensure unique variation names per menu item
  MenuVariationSchema.index({ menuItemId: 1, name: 1 }, { unique: true });
  MenuVariationSchema.index({ menuItemId: 1, displayOrder: 1 });
  MenuVariationSchema.index({ recipeVariantId: 1 });

  return MenuVariationSchema;
};
