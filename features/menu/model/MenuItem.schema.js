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

    // Variants and Add-ons
    variants: [{ type: Schema.Types.ObjectId, ref: 'MenuVariation' }],
    addOns: [{ type: Schema.Types.ObjectId, ref: 'AddOn' }],
  }, { timestamps: true });

  MenuItemSchema.index({ name: 1 });
  MenuItemSchema.index({ slug: 1 }, { unique: true });
  MenuItemSchema.index({ categoryId: 1, displayOrder: 1 });

  return MenuItemSchema;
};
