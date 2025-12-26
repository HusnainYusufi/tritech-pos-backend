'use strict';

/**
 * Main-DB directory mapping email -> tenant slug.
 *
 * Why this exists:
 * - For unauthenticated endpoints like /t/auth/login and /t/auth/forgot-password,
 *   we must resolve which tenant DB to connect to before we can validate credentials.
 * - Deriving tenant from email domain (gmail/outlook) is NOT reliable.
 */

const mongoose = require('mongoose');

const TenantUserDirectorySchema = new mongoose.Schema({
  emailLower: { type: String, required: true, unique: true, trim: true, lowercase: true },
  tenantSlug: { type: String, required: true, trim: true, lowercase: true },
  tenantUserId: { type: mongoose.Schema.Types.ObjectId, required: true },
  userType: { type: String, enum: ['owner', 'staff'], default: 'staff' },
}, { timestamps: true });

TenantUserDirectorySchema.index({ tenantSlug: 1, tenantUserId: 1 }, { unique: true });

module.exports = mongoose.models.TenantUserDirectory
  || mongoose.model('TenantUserDirectory', TenantUserDirectorySchema);


