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
    // Explicitly do NOT include 'key' field - this model uses _id as the key
    // This prevents conflicts with sequence.js model which uses 'key' field
  }, { 
    timestamps: true,
    strict: true,  // Only save fields defined in schema (prevents key field from being saved)
    collection: '__counters'  // Explicitly set collection name
  });

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
  // Validate tenantSlug is provided
  if (!tenantSlug || typeof tenantSlug !== 'string' || tenantSlug.trim() === '') {
    throw new Error('tenantSlug is required and must be a non-empty string');
  }

  // sanitize and standardize tenant prefix
  const sanitizedSlug = String(tenantSlug).trim();
  const prefix = sanitizedSlug
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
    .padEnd(4, 'X');

  const Counter = CounterModel(conn);

  // Use sanitized slug for counter key to avoid null/undefined issues
  const counterKey = `sku:${sanitizedSlug}`;

  // Atomically increment or initialize the counter
  // Use $unset to ensure key field is never set (prevents conflict with sequence.js model)
  // This prevents duplicate key errors when both sku.js and sequence.js use the same collection
  const doc = await Counter.findOneAndUpdate(
    { _id: counterKey },
    { 
      $inc: { seq: 1 },
      $unset: { key: 1 }  // Explicitly remove key field if it exists (prevents duplicate key errors)
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Ensure seq is numeric and padded
  const seqNum = Number(doc.seq || 1);
  const seqStr = String(seqNum).padStart(6, '0');

  return `${prefix}-${seqStr}`;
}

module.exports = { nextSku };
