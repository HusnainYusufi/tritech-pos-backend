

const logger = require('./logger');


async function reserveStock(conn, tenantSlug, order) {
  try {

    return true;
  } catch (e) {
    logger.error('[inventoryHooks.reserveStock] failed', e);
    throw e;
  }
}


async function deductStock(conn, tenantSlug, order) {
  try {

    return true;
  } catch (e) {
    logger.error('[inventoryHooks.deductStock] failed', e);
    throw e;
  }
}


async function releaseStock(conn, tenantSlug, order) {
  try {
    
    return true;
  } catch (e) {
    logger.error('[inventoryHooks.releaseStock] failed', e);
    throw e;
  }
}

module.exports = { reserveStock, deductStock, releaseStock };
