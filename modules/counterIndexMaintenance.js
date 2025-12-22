'use strict';

const logger = require('./logger');

/**
 * Ensure the __counters collection has a sparse key_1 index
 * and remove orphaned documents that can cause duplicate key errors.
 */
async function ensureCountersIndex(conn, tenantSlug) {
  if (!conn?.db) return;
  const collection = conn.db.collection('__counters');

  try {
    const indexes = await collection.indexes();
    const keyIndex = indexes.find((idx) => idx.name === 'key_1');

    if (!keyIndex) {
      logger.info('[counterIndexMaintenance] Creating sparse key_1 index', { tenantSlug });
      await collection.createIndex({ key: 1 }, { unique: true, sparse: true });
    } else if (!keyIndex.sparse) {
      logger.warn('[counterIndexMaintenance] Recreating non-sparse key_1 index as sparse', { tenantSlug });
      await collection.dropIndex('key_1');
      await collection.createIndex({ key: 1 }, { unique: true, sparse: true });
    }

    // Clean orphaned documents that have neither a valid key nor a sku-based _id
    const problematicDocs = await collection
      .find({
        $or: [
          { key: null },
          { key: { $exists: false } },
        ],
      })
      .toArray();

    for (const doc of problematicDocs) {
      const hasValidSkuId = doc._id && String(doc._id).startsWith('sku:');
      const hasValidKey = doc.key != null;
      if (!hasValidSkuId && !hasValidKey) {
        logger.warn('[counterIndexMaintenance] Removing orphaned counter document', { tenantSlug, _id: doc._id });
        await collection.deleteOne({ _id: doc._id });
      }
    }
  } catch (err) {
    logger.error('[counterIndexMaintenance] Failed to ensure counters index', {
      tenantSlug,
      message: err.message,
      stack: err.stack,
    });
  }
}

module.exports = { ensureCountersIndex };
