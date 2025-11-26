const mongoose = require('mongoose');

try {
  'use strict';

  const PriceSchema = new mongoose.Schema({
    monthly: { type: Number, default: 0 },
    quarterly: { type: Number, default: 0 },
    annual: { type: Number, default: 0 },
    currency: { type: String, default: 'PKR' },
  }, { _id: false });

  const FeaturesSchema = new mongoose.Schema({
    staff: Boolean, customers: Boolean, menu: Boolean, orders: Boolean,
    analytics: Boolean, pos: Boolean, inventory: Boolean, branches: Boolean, recipes: Boolean,
  }, { _id: false });

  const PlanSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['trial', 'paid'], default: 'paid' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },

    prices: { type: PriceSchema, default: () => ({}) },
    features: { type: FeaturesSchema, default: () => ({}) },
  }, { timestamps: true });

  PlanSchema.index({ name: 1 }, { unique: true });

  const Plan = mongoose.model('Plan', PlanSchema);
  module.exports = Plan;

} catch (error) { console.error('Error creating Plan schema:', error); }
