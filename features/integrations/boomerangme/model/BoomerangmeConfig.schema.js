'use strict';

/**
 * BoomerangmeConfig Schema
 * 
 * Stores Boomerangme loyalty platform integration settings per tenant.
 * This is stored in each tenant's database (not main DB).
 * 
 * @see https://docs.boomerangme.cards/marketplace/create-an-application
 */
module.exports = (Schema) => {
  const CredentialSchema = new Schema({
    name: { type: String, required: true, trim: true },   // e.g., "tenantSlug", "apiKey"
    value: { type: String, required: true, trim: true }
  }, { _id: false });

  const BoomerangmeConfigSchema = new Schema({
    // Integration toggle
    isEnabled: { type: Boolean, default: false },

    // Boomerangme API authentication
    appToken: { type: String, trim: true, default: null },  // X-App-Token for outbound API calls

    // Credentials that Boomerangme uses to identify this tenant
    // These are sent in /check-credentials and /get-inventory requests
    credentials: { type: [CredentialSchema], default: [] },

    // Webhook security (optional)
    webhookSecret: { type: String, trim: true, default: null },

    // API endpoint (default to production, can override for testing)
    apiBaseUrl: { 
      type: String, 
      trim: true, 
      default: 'https://api.digitalwallet.cards' 
    },

    // Sync tracking
    lastInventorySyncAt: { type: Date, default: null },
    lastAccrualAt: { type: Date, default: null },

    // Statistics
    stats: {
      totalAccruals: { type: Number, default: 0 },
      totalReversals: { type: Number, default: 0 },
      lastError: { type: String, default: null },
      lastErrorAt: { type: Date, default: null }
    },

    // Additional settings
    metadata: { type: Object, default: {} }
  }, { timestamps: true });

  // Only one config per tenant (singleton pattern)
  BoomerangmeConfigSchema.index({ createdAt: 1 });

  return BoomerangmeConfigSchema;
};
