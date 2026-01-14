'use strict';

/**
 * Main DB collection: employeeId -> tenantSlug, tenantUserId
 * Used to resolve tenant from Employee ID + PIN for secure login.
 * 
 * SECURITY: PIN alone is not enough - Employee ID scopes lookup to prevent cross-tenant access.
 */

const mongoose = require('mongoose');

const TenantPinDirectorySchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true, trim: true, uppercase: true }, // EMP-XXXXXX
  pinKey: { type: String, required: true, trim: true }, // HMAC of PIN (unique per tenant, not globally)
  tenantSlug: { type: String, required: true, trim: true, lowercase: true },
  tenantUserId: { type: mongoose.Schema.Types.ObjectId, required: true },
  assignedBranchId: { type: mongoose.Schema.Types.ObjectId, default: null },
  posIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
}, { timestamps: true });

// Employee ID is globally unique (for lookup)
TenantPinDirectorySchema.index({ employeeId: 1 }, { unique: true });
// PIN only needs to be unique within a tenant (not globally)
TenantPinDirectorySchema.index({ tenantSlug: 1, pinKey: 1 }, { unique: true });
TenantPinDirectorySchema.index({ tenantSlug: 1, tenantUserId: 1 });

module.exports = mongoose.models.TenantPinDirectory
  || mongoose.model('TenantPinDirectory', TenantPinDirectorySchema);


