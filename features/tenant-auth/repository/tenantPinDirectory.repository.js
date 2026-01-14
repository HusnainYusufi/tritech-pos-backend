'use strict';

const crypto = require('crypto');
const TenantPinDirectory = require('../model/TenantPinDirectory.model');

// Generate random Employee ID: EMP-XXXXXX (6 uppercase alphanumeric, no confusing chars)
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // No 0,O,1,I,L
const generateEmployeeId = () => {
  let id = 'EMP-';
  for (let i = 0; i < 6; i++) {
    id += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return id;
};

class TenantPinDirectoryRepository {
  static normalizePinKey(pinKey) {
    return pinKey ? String(pinKey).trim() : null;
  }

  static normalizeEmployeeId(empId) {
    return empId ? String(empId).trim().toUpperCase() : null;
  }

  /**
   * Generate a unique Employee ID (retries on collision)
   */
  static async generateUniqueEmployeeId(maxRetries = 5) {
    for (let i = 0; i < maxRetries; i++) {
      const empId = generateEmployeeId();
      const exists = await TenantPinDirectory.findOne({ employeeId: empId }).lean();
      if (!exists) return empId;
    }
    // Fallback: append timestamp
    return `EMP-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  }

  /**
   * Upsert PIN directory entry (now requires employeeId)
   */
  static async upsert({ employeeId, pinKey, tenantSlug, tenantUserId, assignedBranchId = null, posIds = [], status = 'active' }) {
    const pk = this.normalizePinKey(pinKey);
    const empId = this.normalizeEmployeeId(employeeId);
    if (!pk) throw new Error('pinKey required');
    if (!empId) throw new Error('employeeId required');
    if (!tenantSlug) throw new Error('tenantSlug required');
    if (!tenantUserId) throw new Error('tenantUserId required');

    const slug = String(tenantSlug).trim().toLowerCase();

    return TenantPinDirectory.findOneAndUpdate(
      { tenantSlug: slug, tenantUserId },
      {
        employeeId: empId,
        pinKey: pk,
        tenantSlug: slug,
        tenantUserId,
        assignedBranchId: assignedBranchId || null,
        posIds: Array.isArray(posIds) ? posIds : [],
        status,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
  }

  /**
   * Find by Employee ID (primary lookup for login)
   */
  static async findByEmployeeId(employeeId) {
    const empId = this.normalizeEmployeeId(employeeId);
    if (!empId) return null;
    return TenantPinDirectory.findOne({ employeeId: empId }).lean();
  }

  /**
   * Find by tenant + user (for updates)
   */
  static async findByTenantUser(tenantSlug, tenantUserId) {
    if (!tenantSlug || !tenantUserId) return null;
    return TenantPinDirectory.findOne({ 
      tenantSlug: String(tenantSlug).toLowerCase(), 
      tenantUserId 
    }).lean();
  }

  /**
   * @deprecated Use findByEmployeeId instead
   */
  static async findByPinKey(pinKey) {
    const pk = this.normalizePinKey(pinKey);
    if (!pk) return null;
    return TenantPinDirectory.findOne({ pinKey: pk }).lean();
  }
}

module.exports = TenantPinDirectoryRepository;


