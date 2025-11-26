'use strict';

module.exports = (Schema) => {
  const AddOnGroupSchema = new Schema({
    categoryId: { type: Schema.Types.ObjectId, ref: 'MenuCategory', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },   // e.g., SAUCES
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
    metadata: { type: Object, default: {} },
  }, { timestamps: true });

  AddOnGroupSchema.index({ categoryId: 1, displayOrder: 1 });
  AddOnGroupSchema.index({ categoryId: 1, name: 1 }, { unique: true });

  return AddOnGroupSchema;
};
