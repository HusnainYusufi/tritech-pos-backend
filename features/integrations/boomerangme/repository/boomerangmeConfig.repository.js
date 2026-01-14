'use strict';

const { getTenantModel } = require('../../../../modules/tenantModels');
const schemaFactory = require('../model/BoomerangmeConfig.schema');

function BoomerangmeConfig(conn) {
  return getTenantModel(conn, 'BoomerangmeConfig', schemaFactory, 'boomerangme_configs');
}

class BoomerangmeConfigRepository {
  static model(conn) { 
    return BoomerangmeConfig(conn); 
  }

  /**
   * Get the singleton config for this tenant
   * Creates a default config if none exists
   */
  static async getOrCreate(conn) {
    let config = await BoomerangmeConfig(conn).findOne().lean();
    if (!config) {
      config = await BoomerangmeConfig(conn).create({
        isEnabled: false,
        credentials: [],
        stats: {
          totalAccruals: 0,
          totalReversals: 0
        }
      });
      config = config.toObject();
    }
    return config;
  }

  /**
   * Get the singleton config (returns null if not configured)
   */
  static async get(conn) {
    return BoomerangmeConfig(conn).findOne().lean();
  }

  /**
   * Get the config document for updates
   */
  static async getDoc(conn) {
    return BoomerangmeConfig(conn).findOne();
  }

  /**
   * Update the singleton config (upsert pattern)
   */
  static async upsert(conn, data) {
    const existing = await BoomerangmeConfig(conn).findOne();
    
    if (existing) {
      Object.assign(existing, data);
      await existing.save();
      return existing.toObject();
    }
    
    const created = await BoomerangmeConfig(conn).create(data);
    return created.toObject();
  }

  /**
   * Update specific fields
   */
  static async update(conn, patch) {
    return BoomerangmeConfig(conn).findOneAndUpdate(
      {},
      { $set: patch },
      { new: true, upsert: true }
    ).lean();
  }

  /**
   * Check if integration is enabled
   */
  static async isEnabled(conn) {
    const config = await BoomerangmeConfig(conn).findOne().select('isEnabled').lean();
    return config?.isEnabled === true;
  }

  /**
   * Validate credentials against stored config
   * @param {Object} conn - Tenant connection
   * @param {Array} credentials - Array of { name, value } pairs
   * @returns {boolean} Whether credentials are valid
   */
  static async validateCredentials(conn, credentials = []) {
    const config = await BoomerangmeConfig(conn).findOne().select('credentials isEnabled').lean();
    
    if (!config || !config.isEnabled) {
      return false;
    }

    if (!config.credentials || config.credentials.length === 0) {
      return false;
    }

    // Check that all provided credentials match
    for (const provided of credentials) {
      const stored = config.credentials.find(c => c.name === provided.name);
      if (!stored || stored.value !== provided.value) {
        return false;
      }
    }

    return true;
  }

  /**
   * Increment accrual counter
   */
  static async incrementAccruals(conn) {
    return BoomerangmeConfig(conn).findOneAndUpdate(
      {},
      { 
        $inc: { 'stats.totalAccruals': 1 },
        $set: { lastAccrualAt: new Date() }
      },
      { new: true }
    ).lean();
  }

  /**
   * Increment reversal counter
   */
  static async incrementReversals(conn) {
    return BoomerangmeConfig(conn).findOneAndUpdate(
      {},
      { 
        $inc: { 'stats.totalReversals': 1 }
      },
      { new: true }
    ).lean();
  }

  /**
   * Record an error
   */
  static async recordError(conn, errorMessage) {
    return BoomerangmeConfig(conn).findOneAndUpdate(
      {},
      { 
        $set: { 
          'stats.lastError': errorMessage,
          'stats.lastErrorAt': new Date()
        }
      },
      { new: true }
    ).lean();
  }

  /**
   * Update last inventory sync time
   */
  static async updateInventorySyncTime(conn) {
    return BoomerangmeConfig(conn).findOneAndUpdate(
      {},
      { $set: { lastInventorySyncAt: new Date() } },
      { new: true }
    ).lean();
  }
}

module.exports = BoomerangmeConfigRepository;
