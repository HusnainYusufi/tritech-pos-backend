'use strict';

/**
 * Main DB collection: pinKey -> tenantSlug, tenantUserId
 * Used to resolve tenant from PIN without client providing slug.
 */

const mongoose = require('mongoose');

const TenantPinDirectorySchema = new mongoose.Schema({
  pinKey: { type: String, required: true, unique: true, trim: true }, // HMAC of PIN with PIN_PEPPER
  tenantSlug: { type: String, required: true, trim: true, lowercase: true },
  tenantUserId: { type: mongoose.Schema.Types.ObjectId, required: true },
  assignedBranchId: { type: mongoose.Schema.Types.ObjectId, default: null },
  posIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
}, { timestamps: true });

TenantPinDirectorySchema.index({ pinKey: 1 }, { unique: true });
TenantPinDirectorySchema.index({ tenantSlug: 1, tenantUserId: 1 });

module.exports = mongoose.models.TenantPinDirectory
  || mongoose.model('TenantPinDirectory', TenantPinDirectorySchema);


