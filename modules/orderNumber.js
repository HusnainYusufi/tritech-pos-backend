// modules/orderNumber.js
'use strict';

const moment = require('moment');

/**
 * Generate unique order number with format: PREFIX-YYYYMMDD-NNNN
 * Example: ORD-20240115-0001
 * 
 * @param {string} prefix - Order prefix from branch config (default: 'ORD')
 * @param {number} sequenceNumber - Sequential number for the day
 * @returns {string} Formatted order number
 */
function generateOrderNumber(prefix = 'ORD', sequenceNumber = 1) {
  const dateStr = moment().format('YYYYMMDD');
  const seqStr = String(sequenceNumber).padStart(4, '0');
  return `${prefix}-${dateStr}-${seqStr}`;
}

/**
 * Get next sequence number for today
 * This should be called within a transaction to ensure uniqueness
 * 
 * @param {Connection} conn - Mongoose connection
 * @param {string} branchId - Branch ID
 * @param {string} prefix - Order prefix
 * @returns {Promise<number>} Next sequence number
 */
async function getNextSequenceNumber(conn, branchId, prefix = 'ORD') {
  const PosOrder = conn.models.PosOrder || conn.model('PosOrder');
  
  const today = moment().startOf('day').toDate();
  const tomorrow = moment().add(1, 'day').startOf('day').toDate();
  
  // Find the highest order number for today
  const lastOrder = await PosOrder.findOne({
    branchId,
    orderNumber: new RegExp(`^${prefix}-${moment().format('YYYYMMDD')}-`),
    createdAt: { $gte: today, $lt: tomorrow }
  })
  .sort({ orderNumber: -1 })
  .select('orderNumber')
  .lean();

  if (!lastOrder) {
    return 1;
  }

  // Extract sequence number from order number (e.g., ORD-20240115-0001 -> 0001)
  const parts = lastOrder.orderNumber.split('-');
  const lastSeq = parseInt(parts[parts.length - 1], 10) || 0;
  
  return lastSeq + 1;
}

/**
 * Generate next order number for a branch
 * 
 * @param {Connection} conn - Mongoose connection
 * @param {string} branchId - Branch ID
 * @param {string} prefix - Order prefix from branch config
 * @returns {Promise<string>} Generated order number
 */
async function generateNextOrderNumber(conn, branchId, prefix = 'ORD') {
  const sequenceNumber = await getNextSequenceNumber(conn, branchId, prefix);
  return generateOrderNumber(prefix, sequenceNumber);
}

module.exports = {
  generateOrderNumber,
  getNextSequenceNumber,
  generateNextOrderNumber
};

