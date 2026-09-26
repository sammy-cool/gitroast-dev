const { Redis } = require("@upstash/redis");
const { logger } = require("../utils/logger");

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

let redisClient = null;
const isConfigured = Boolean(url && token);

if (isConfigured) {
  try {
    redisClient = new Redis({ url, token });
    logger.info("Redis", "Connected to Upstash Serverless Redis");
  } catch (err) {
    logger.warn("Redis", "Failed to initialize Upstash Redis, falling back to in-memory store", {
      message: err.message,
    });
    redisClient = null;
  }
} else {
  logger.info("Redis", "Upstash Redis credentials not set — running with local in-memory store");
}

const memoryStore = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memoryStore.entries()) {
    if (v.expiresAt && v.expiresAt < now) {
      memoryStore.delete(k);
    }
  }
  if (memoryStore.size >= 50000) memoryStore.clear();
}, 5 * 60 * 1000).unref();

async function incrWithTtl(key, ttlSeconds = 60) {
  if (redisClient) {
    try {
      const count = await redisClient.incr(key);
      let ttl = await redisClient.ttl(key);
      if (count === 1 || ttl === -1) {
        await redisClient.expire(key, ttlSeconds);
        ttl = ttlSeconds;
      }
      return { count, ttl: ttl > 0 ? ttl : ttlSeconds };
    } catch (err) {
      logger.warn("Redis", "Redis incr error, using in-memory fallback", { message: err.message });
    }
  }

  const now = Date.now();
  const existing = memoryStore.get(key);
  if (!existing || existing.expiresAt < now) {
    memoryStore.set(key, { count: 1, expiresAt: now + ttlSeconds * 1000 });
    return { count: 1, ttl: ttlSeconds };
  }

  existing.count += 1;
  const remainingSecs = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));
  return { count: existing.count, ttl: remainingSecs };
}

async function get(key) {
  if (redisClient) {
    try {
      return await redisClient.get(key);
    } catch (err) {
      logger.warn("Redis", "Redis get error, falling back to memory", { message: err.message });
    }
  }
  const item = memoryStore.get(key);
  if (!item) return null;
  if (item.expiresAt && item.expiresAt < Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return item.value !== undefined ? item.value : item;
}

async function set(key, value, ttlSeconds = null) {
  if (redisClient) {
    try {
      if (ttlSeconds) {
        return await redisClient.set(key, value, { ex: ttlSeconds });
      }
      return await redisClient.set(key, value);
    } catch (err) {
      logger.warn("Redis", "Redis set error, falling back to memory", { message: err.message });
    }
  }
  const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
  memoryStore.set(key, { value, expiresAt });
  return "OK";
}

module.exports = {
  isConfigured,
  incrWithTtl,
  get,
  set,
  redisClient,
};
