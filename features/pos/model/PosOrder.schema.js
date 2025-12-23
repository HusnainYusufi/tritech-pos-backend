// features/pos/model/PosOrder.schema.js
'use strict';

const auditPlugin = require('../../../modules/audit.plugin');

module.exports = (Schema) => {
  // ✅ NEW: Variation selection schema for order items
  const OrderItemVariationSchema = new Schema({
    menuVariationId: { type: Schema.Types.ObjectId, ref: 'MenuVariation', required: true },
    recipeVariantId: { type: Schema.Types.ObjectId, ref: 'RecipeVariant', default: null },
    nameSnapshot: { type: String, trim: true, required: true },
    type: { type: String, enum: ['size','crust','flavor','addon','combo','custom'], default: 'custom' },
    priceDelta: { type: Number, default: 0 },
    sizeMultiplier: { type: Number, default: 1 },
    calculatedCost: { type: Number, default: 0 }
  }, { _id: false });

  const PosOrderItemSchema = new Schema({
    menuItemId: { type: Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    recipeIdSnapshot: { type: Schema.Types.ObjectId, ref: 'Recipe', default: null },
    
    // ✅ CRITICAL FIX: Capture selected variations for proper inventory deduction and cost tracking
    selectedVariations: { type: [OrderItemVariationSchema], default: [] },
    
    nameSnapshot: { type: String, trim: true },
    codeSnapshot: { type: String, trim: true },
    categoryIdSnapshot: { type: Schema.Types.ObjectId, ref: 'MenuCategory', default: null },
    quantity: { type: Number, min: 1, required: true },
    unitPrice: { type: Number, min: 0, default: 0 },
    lineTotal: { type: Number, min: 0, default: 0 },
    
    // ✅ NEW: Track actual cost for profit margin reporting
    calculatedCost: { type: Number, default: 0 },
    
    priceIncludesTax: { type: Boolean, default: false },
    notes: { type: String, trim: true, maxlength: 500 },
    metadata: { type: Schema.Types.Mixed },
  }, { _id: false });

  const PosOrderSchema = new Schema({
    orderNumber: { type: String, required: true, unique: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    posId: { type: Schema.Types.ObjectId, ref: 'PosTerminal', default: null },
    tillSessionId: { type: Schema.Types.ObjectId, ref: 'TillSession', default: null },
    staffId: { type: Schema.Types.ObjectId, ref: 'TenantUser', required: true },
    status: {
      type: String,
      enum: ['placed', 'paid', 'void', 'refunded'],
      default: 'placed',
    },
    customerName: { type: String, trim: true, maxlength: 120 },
    customerPhone: { type: String, trim: true, maxlength: 20 },
    notes: { type: String, trim: true, maxlength: 500 },
    items: {
      type: [PosOrderItemSchema],
      default: [],
      validate: [(arr) => Array.isArray(arr) && arr.length > 0, 'Order must have at least one item'],
    },
    totals: {
      subTotal: { type: Number, min: 0, default: 0 },
      taxTotal: { type: Number, min: 0, default: 0 },
      discount: { type: Number, min: 0, default: 0 },
      grandTotal: { type: Number, min: 0, default: 0 },
    },
    payment: {
      method: { type: String, enum: ['cash','card','mobile','split'], default: 'cash' },
      amountPaid: { type: Number, min: 0, default: 0 },
      change: { type: Number, min: 0, default: 0 },
      paidAt: { type: Date, default: null },
      reference: { type: String, trim: true, default: '' },
    },
    pricingSnapshot: {
      currency: { type: String, trim: true, default: 'SAR' },
      priceIncludesTax: { type: Boolean, default: false },
      taxMode: { type: String, trim: true, default: null },
      taxRate: { type: Number, min: 0, default: 0 },
    },
  }, { timestamps: true });

  PosOrderSchema.index({ branchId: 1, createdAt: -1 });
  PosOrderSchema.index({ staffId: 1, createdAt: -1 });
  PosOrderSchema.index({ tillSessionId: 1 });

  PosOrderSchema.plugin(auditPlugin);

  return PosOrderSchema;
};
