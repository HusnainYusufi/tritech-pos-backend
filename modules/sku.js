'use strict';

const mongoose = require('mongoose');

/**
 * CounterModel
 * Each tenant gets its own SKU counter stored in the shared "__counters" collection.
 * Key pattern: sku:<tenantSlug>
 */
function CounterModel(conn) {
  const CounterSchema = new mongoose.Schema({
    _id: { type: String, required: true },   // e.g. sku:legend, sku:macd
    seq: { type: Number, default: 0 },
  }, { timestamps: true });

  // Prevent model overwrite errors on hot reload
  return conn.models.__Counter || conn.model('__Counter', CounterSchema, '__counters');
}

/**
 * nextSku
 * Generates a strictly increasing, tenant-scoped SKU:
 *   <PREFIX>-<6-digit sequence>
 * Example:
 *   For tenantSlug = "macdonalds" → MACD-000123
 */
async function nextSku(conn, tenantSlug) {
  // sanitize and standardize tenant prefix
  const prefix = String(tenantSlug || 'TEN')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
    .padEnd(4, 'X');

  const Counter = CounterModel(conn);

  // Atomically increment or initialize the counter
  const doc = await Counter.findOneAndUpdate(
    { _id: `sku:${tenantSlug}` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Ensure seq is numeric and padded
  const seqNum = Number(doc.seq || 1);
  const seqStr = String(seqNum).padStart(6, '0');

  return `${prefix}-${seqStr}`;
}

module.exports = { nextSku };
