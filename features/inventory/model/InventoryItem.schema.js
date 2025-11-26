// features/inventory/model/InventoryItem.schema.js
module.exports = (Schema) => {
  const InventoryItemSchema = new Schema({
    name:     { type: String, required: true, trim: true, maxlength: 160 },
    sku:      { type: String, required: true, trim: true, unique: true }, // auto-generated
    type:     { type: String, enum: ['stock','nonstock','service'], default: 'stock' },

    categoryId: { type: Schema.Types.ObjectId, ref: 'InventoryCategory', required: false, index: true },
    categoryNameSnapshot: { type: String, default: '' }, // denormalized for reporting

    isActive: { type: Boolean, default: true },

    // Units (you’ll plug into your units module later)
    baseUnit:     { type: String, default: '' },    // e.g., 'pc', 'g', 'ml'
    purchaseUnit: { type: String, default: '' },    // optional
    conversion:   { type: Number, default: 1 },     // purchaseUnit -> baseUnit factor

    // Stock settings (extend later)
    reorderPoint: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    // Multi-branch later: keep general fields now
    branches: { type: [Schema.Types.ObjectId], default: [] },

    // Optional fields seen in UI
    notes:    { type: String, default: '' },
    metadata: { type: Object, default: {} },
  }, { timestamps: true });

  InventoryItemSchema.index({ name: 1 });
  InventoryItemSchema.index({ sku: 1 }, { unique: true });

  return InventoryItemSchema;
};
