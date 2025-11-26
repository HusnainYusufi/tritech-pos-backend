'use strict';

module.exports = (Schema) => {
  const AddOnItemSchema = new Schema({
    groupId: { type: Schema.Types.ObjectId, ref: 'AddOnGroup', required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'MenuCategory', required: true, index: true },

    // Link to either inventory or recipe
    sourceType: { type: String, enum: ['inventory','recipe'], required: true },
    sourceId: { type: Schema.Types.ObjectId, required: true, index: true },

    // snapshot for fast POS rendering (name can be overridden/pretty)
    nameSnapshot: { type: String, required: true, trim: true },

    price: { type: Number, default: 0 },       // selling price for this add-on
    unit: { type: String, default: 'unit' },   // optional label

    isRequired: { type: Boolean, default: false }, // required vs optional

    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
    metadata: { type: Object, default: {} },
  }, { timestamps: true });

  AddOnItemSchema.index({ groupId: 1, displayOrder: 1 });
  AddOnItemSchema.index({ groupId: 1, nameSnapshot: 1 });

  return AddOnItemSchema;
};
