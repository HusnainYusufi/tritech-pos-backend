'use strict';

const TenantPinDirectory = require('../model/TenantPinDirectory.model');

class TenantPinDirectoryRepository {
  static normalizePinKey(pinKey) {
    return pinKey ? String(pinKey).trim() : null;
  }

  static async upsert({ pinKey, tenantSlug, tenantUserId, assignedBranchId = null, posIds = [], status = 'active' }) {
    const pk = this.normalizePinKey(pinKey);
    if (!pk) throw new Error('pinKey required');
    if (!tenantSlug) throw new Error('tenantSlug required');
    if (!tenantUserId) throw new Error('tenantUserId required');

    return TenantPinDirectory.findOneAndUpdate(
      { pinKey: pk },
      {
        pinKey: pk,
        tenantSlug: String(tenantSlug).trim().toLowerCase(),
        tenantUserId,
        assignedBranchId: assignedBranchId || null,
        posIds: Array.isArray(posIds) ? posIds : [],
        status,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
  }

  static async findByPinKey(pinKey) {
    const pk = this.normalizePinKey(pinKey);
    if (!pk) return null;
    return TenantPinDirectory.findOne({ pinKey: pk }).lean();
  }
}

module.exports = TenantPinDirectoryRepository;


