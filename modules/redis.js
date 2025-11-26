// modules/redis.js
const { createClient } = require('redis');
const logger = require('./logger');

const url =
  process.env.REDIS_URL ||
  `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || '6379'}`;

const client = createClient({ url });

client.on('error', (err) => logger.error(`Redis Client Error: ${err.message}`));

let readyPromise = null;
function ensureRedis() {
  if (!readyPromise) {
    readyPromise = client
      .connect()
      .then(() => logger.info('✅ Redis connected'))
      .catch((err) => {
        logger.error('Redis connect failed', err);
        readyPromise = null; // allow retry next call
        throw err;
      });
  }
  return readyPromise;
}

// Kick off connect in the background; callers can still await ensureRedis()
ensureRedis().catch(() => { /* ignore here; callers handle */ });

module.exports = { redisClient: client, ensureRedis };
