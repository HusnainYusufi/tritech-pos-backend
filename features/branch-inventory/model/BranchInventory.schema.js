'use strict';

module.exports = (Schema) => {
  const BranchInventorySchema = new Schema({
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },

    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true,
      index: true,
    },

    // Snapshots from master inventory (for stable display)
    itemNameSnapshot: { type: String, required: true, trim: true },
    skuSnapshot: { type: String, default: '', trim: true },

    // Branch-level stock & pricing
    quantity: { type: Number, default: 0 },        // current stock at this branch
    reorderPoint: { type: Number, default: 0 },
    minStock: { type: Number, default: 0 },
    maxStock: { type: Number, default: 0 },

    costPerUnit: { type: Number, default: 0 },     // branch landed cost (optional)
    sellingPrice: { type: Number, default: 0 },    // branch selling price (optional)

    isActive: { type: Boolean, default: true },

    metadata: { type: Object, default: {} },
  }, { timestamps: true });

  // One inventory item per branch (no duplicates)
  BranchInventorySchema.index({ branchId: 1, itemId: 1 }, { unique: true });

  // Helpful indexes for search
  BranchInventorySchema.index({ branchId: 1, skuSnapshot: 1 });
  BranchInventorySchema.index({ branchId: 1, itemNameSnapshot: 1 });

  return BranchInventorySchema;
};
