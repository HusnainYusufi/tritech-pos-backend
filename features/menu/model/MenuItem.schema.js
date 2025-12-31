'use strict';

module.exports = (Schema) => {
  const MediaSchema = new Schema({
    url: { type: String, trim: true },
    alt: { type: String, trim: true, default: '' },
    type: { type: String, enum: ['image', 'video'], default: 'image' }
  }, { _id: false });

  const MenuItemSchema = new Schema({
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    code: { type: String, trim: true, default: '' },
    description: { type: String, default: '' },

    categoryId: { type: Schema.Types.ObjectId, ref: 'MenuCategory', index: true, default: null },
    recipeId: { type: Schema.Types.ObjectId, ref: 'Recipe', default: null },

    pricing: {
      basePrice: { type: Number, default: 0 },
      priceIncludesTax: { type: Boolean, default: false },
      currency: { type: String, default: 'SAR' }
    },

    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
    tags: { type: [String], default: [] },

    media: { type: [MediaSchema], default: [] },

    branchIds: { type: [Schema.Types.ObjectId], default: [] },
    metadata: { type: Object, default: {} },

    // ✅ PRODUCTION-GRADE LINKING ARCHITECTURE:
    // 
    // VARIATIONS: Item-specific (1:N relationship)
    // - MenuVariation.menuItemId → MenuItem._id
    // - MenuItem.variants[] ← Auto-populated by MenuVariationService
    // - Used for: Size options (Small/Medium/Large), Crust types, Flavors
    variants: [{ type: Schema.Types.ObjectId, ref: 'MenuVariation' }],
    
    // ADD-ONS: Category-based (Industry Standard Pattern)
    // - MenuItem.categoryId → MenuCategory._id → AddOnGroup.categoryId → AddOnItem
    // - All items in same category share add-on groups
    // - Used for: Toppings, Sauces, Extras, Sides
    // - Matches: McDonald's, Domino's, Subway patterns
    // 
    // Note: Removed broken 'addOns' field (referenced non-existent 'AddOn' model)
    // Add-ons are now fetched dynamically by category in POS menu service
  }, { timestamps: true });

  MenuItemSchema.index({ name: 1 });
  MenuItemSchema.index({ slug: 1 }, { unique: true });
  MenuItemSchema.index({ categoryId: 1, displayOrder: 1 });

  return MenuItemSchema;
};
