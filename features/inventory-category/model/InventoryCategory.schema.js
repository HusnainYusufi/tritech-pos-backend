// features/inventory-category/model/InventoryCategory.schema.js
module.exports = (Schema) => {
  const InventoryCategorySchema = new Schema({
    name:        { type: String, required: true, trim: true, maxlength: 120 },
    slug:        { type: String, required: true, trim: true, lowercase: true, unique: true },
    code:        { type: String, trim: true, maxlength: 24, default: '' }, // optional human code
    description: { type: String, default: '' },

    parentId:    { type: Schema.Types.ObjectId, ref: 'InventoryCategory', default: null }, // nested categories
    path:        { type: [Schema.Types.ObjectId], default: [] }, // ancestry chain for fast tree queries

    isActive:    { type: Boolean, default: true },
    displayOrder:{ type: Number, default: 0 }, // for UI priority sorting

    metadata:    { type: Object, default: {} },
  }, { timestamps: true });

  InventoryCategorySchema.index({ slug: 1 }, { unique: true });
  InventoryCategorySchema.index({ name: 1 });
  InventoryCategorySchema.index({ parentId: 1 });

  return InventoryCategorySchema;
};
