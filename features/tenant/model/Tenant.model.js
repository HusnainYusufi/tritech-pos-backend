// features/tenant/model/Tenant.model.js
const mongoose = require('mongoose');

const TenantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  dbUri: { type: String, required: true }, // 🔥 new field for tenant DB
  status: { type: String, enum: ['paid', 'unpaid', 'suspended', 'trial'], default: 'trial' },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
  contactEmail: { type: String },
  contactPhone: { type: String },
  website: { type: String },
  logoUrl: { type: String },
  address: {
    country: String,
    city: String,
    line: String,
  },
  branches: [{ name: String, code: String }], // optional branch list
  registrationDate: { type: Date, default: Date.now },
  lastUpdatedAt: { type: Date, default: Date.now },
});

TenantSchema.pre('save', function (next) {
  this.lastUpdatedAt = Date.now();
  next();
});

const Tenant = mongoose.model('Tenant', TenantSchema);
module.exports = Tenant;
