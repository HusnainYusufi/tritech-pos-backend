'use strict';

const { getTenantModel } = require('./tenantModels');

function Counter(conn) {
  if (conn.models.__Counters) return conn.models.__Counters;
  const schema = new conn.base.Schema({
    key: { type: String, required: true, unique: true },   // e.g. 'sku'
    seq: { type: Number, default: 0 }
  }, { collection: '__counters', timestamps: false });
  return conn.model('__Counters', schema);
}

/** Atomically allocate a block of sequence numbers for a key */
async function allocateSequence(conn, key, count = 1) {
  const doc = await Counter(conn).findOneAndUpdate(
    { key },
    { $inc: { seq: count } },
    { new: true, upsert: true }
  ).lean();
  const end = doc.seq;
  const start = end - count + 1;
  return { start, end };
}

module.exports = { allocateSequence };
