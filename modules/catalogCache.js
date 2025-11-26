// modules/catalogCache.js
const { redisClient, ensureRedis } = require('./redis');

const KEY = (tenantSlug, branchId) => `pos:menu:${tenantSlug}:${branchId}`;

async function getPosMenu(tenantSlug, branchId) {
  await ensureRedis();
  const raw = await redisClient.get(KEY(tenantSlug, branchId));
  return raw ? JSON.parse(raw) : null;
}

async function setPosMenu(tenantSlug, branchId, payload, ttlSec = 300) {
  await ensureRedis();
  await redisClient.set(KEY(tenantSlug, branchId), JSON.stringify(payload), { EX: ttlSec });
}

async function invalidatePosMenu(tenantSlug, branchId) {
  await ensureRedis();
  await redisClient.del(KEY(tenantSlug, branchId));
}

module.exports = { getPosMenu, setPosMenu, invalidatePosMenu };
