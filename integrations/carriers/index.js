'use strict';
const { v4: uuidv4 } = require('uuid');

/**
 * Pluggable adapter pattern. Each adapter provides:
 *   async createShipment({ order, items, requestedBy }) => { trackingNumber, labelUrl?, raw? }
 *
 * Replace with real API calls when you're ready (NAQEL, SMSA, ARAMEX).
 */
const adapters = {
  LEGEND: {
    async createShipment({ order, items, requestedBy }) {
      // Internal: generate a tracking; label can be your existing label module in future
      const trackingNumber = 'LD-' + uuidv4().split('-')[0].toUpperCase();
      return { trackingNumber, labelUrl: null, raw: { provider: 'LEGEND' } };
    }
  },
  NAQEL: {
    async createShipment({ order, items, requestedBy }) {
      // TODO: call NAQEL API here and return their tracking number + label
      const trackingNumber = 'NQ-' + uuidv4().split('-')[0].toUpperCase();
      return { trackingNumber, labelUrl: null, raw: { provider: 'NAQEL' } };
    }
  },
  SMSA: {
    async createShipment() {
      const trackingNumber = 'SMSA-' + uuidv4().split('-')[0].toUpperCase();
      return { trackingNumber, labelUrl: null, raw: { provider: 'SMSA' } };
    }
  },
  ARAMEX: {
    async createShipment() {
      const trackingNumber = 'ARMX-' + uuidv4().split('-')[0].toUpperCase();
      return { trackingNumber, labelUrl: null, raw: { provider: 'ARAMEX' } };
    }
  }
};

function getAdapter(code) {
  const key = String(code || '').toUpperCase();
  const ad = adapters[key];
  if (!ad) throw new Error(`No carrier adapter for code ${key}`);
  return ad;
}

module.exports = { getAdapter };
