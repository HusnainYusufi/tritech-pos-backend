'use strict';

const TenantUserDirectory = require('../model/TenantUserDirectory.model');

class TenantUserDirectoryRepository {
  static normalizeEmail(email) {
    if (!email || typeof email !== 'string') return null;
    const e = email.trim().toLowerCase();
    return e.includes('@') ? e : null;
  }

  static async findByEmail(email) {
    const emailLower = this.normalizeEmail(email);
    if (!emailLower) return null;
    return TenantUserDirectory.findOne({ emailLower }).lean();
  }

  static async upsertByEmail({ email, tenantSlug, tenantUserId, userType = 'staff' }) {
    const emailLower = this.normalizeEmail(email);
    if (!emailLower) return null;
    if (!tenantSlug) throw new Error('TenantUserDirectoryRepository.upsertByEmail: tenantSlug required');
    if (!tenantUserId) throw new Error('TenantUserDirectoryRepository.upsertByEmail: tenantUserId required');

    return TenantUserDirectory.findOneAndUpdate(
      { emailLower },
      { emailLower, tenantSlug: String(tenantSlug).toLowerCase().trim(), tenantUserId, userType },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
  }
}

module.exports = TenantUserDirectoryRepository;


