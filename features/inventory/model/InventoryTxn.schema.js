// features/inventory/model/InventoryTxn.schema.js
module.exports = (Schema) => {
  const InventoryTxnSchema = new Schema({
    branchId:   { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    itemId:     { type: Schema.Types.ObjectId, ref: 'StockItem', required: true, index: true },
    type: { type: String, enum: ['receipt','usage','waste','adjust','transferOut','transferIn','prep'], required: true },
    qty:  { type: Number, required: true }, // in usageUnit (+/-)
    unitCostPerUsageUnit: { type: Number, default: 0 },
    ref: {
      orderId: { type: Schema.Types.ObjectId, default: null },
      recipeId:{ type: Schema.Types.ObjectId, default: null },
      fromBranchId: { type: Schema.Types.ObjectId, default: null },
      toBranchId:   { type: Schema.Types.ObjectId, default: null },
      note: { type: String, default: '' }
    },
    createdBy: { type: String, default: null },
  }, { timestamps: true });

  InventoryTxnSchema.index({ type: 1, createdAt: -1 });
  return InventoryTxnSchema;
};
