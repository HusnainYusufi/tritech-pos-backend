'use strict';

module.exports = (Schema) => {
  const MenuCategorySchema = new Schema({
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    code: { type: String, trim: true, default: '' },
    description: { type: String, default: '' },

    parentId: { type: Schema.Types.ObjectId, ref: 'MenuCategory', default: null, index: true },
    path: { type: [Schema.Types.ObjectId], default: [] }, // ancestors chain

    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },

    metadata: { type: Object, default: {} },
  }, { timestamps: true });

  MenuCategorySchema.index({ name: 1 });
  MenuCategorySchema.index({ slug: 1 }, { unique: true });
  MenuCategorySchema.index({ parentId: 1, displayOrder: 1 });

  return MenuCategorySchema;
};
