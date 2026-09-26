const redisService = require("../services/redisService");

const requestCounts = new Map();

setInterval(
  () => {
    const now = Date.now();
    for (const [key, data] of requestCounts.entries()) {
      if (data.resetTime < now) {
        requestCounts.delete(key);
      }
    }
    if (requestCounts.size >= 50000) {
      requestCounts.clear();
    }
  },
  5 * 60 * 1000,
).unref();

function createRateLimiter({
  windowMs = 60 * 1000,
  maxRequests = 25,
  message = "Too many requests. Please slow down.",
} = {}) {
  return function rateLimiter(req, res, next) {
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      "unknown";

    const now = Date.now();

    let routeScope = req.baseUrl || req.path;
    if (req.baseUrl === "/api/roast") {
      if (req.path === "/feed" || req.path === "/stats") {
        routeScope = `/api/roast${req.path}`;
      } else {
        routeScope = "/api/roast/profile";
      }
    } else if (req.baseUrl === "/api/battle") {
      routeScope = "/api/battle";
    }

    const key = `${ip}:${routeScope}`;

    if (redisService.isConfigured) {
      const ttlSeconds = Math.ceil(windowMs / 1000);
      redisService
        .incrWithTtl(key, ttlSeconds)
        .then(({ count, ttl }) => {
          if (count > maxRequests) {
            res.setHeader("Retry-After", ttl);
            res.setHeader("X-RateLimit-Limit", maxRequests);
            res.setHeader("X-RateLimit-Remaining", 0);
            return res.status(429).json({
              error: "RATE_LIMIT_EXCEEDED",
              message,
              retryAfter: ttl,
            });
          }
          res.setHeader("X-RateLimit-Limit", maxRequests);
          res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - count));
          next();
        })
        .catch(() => {
          next();
        });
      return;
    }

    const existing = requestCounts.get(key);

    if (!existing || existing.resetTime < now) {
      requestCounts.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader("X-RateLimit-Remaining", maxRequests - 1);
      return next();
    }

    existing.count++;

    if (existing.count > maxRequests) {
      const retryAfter = Math.ceil((existing.resetTime - now) / 1000);

      res.setHeader("Retry-After", retryAfter);
      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader("X-RateLimit-Remaining", 0);

      return res.status(429).json({
        error: "RATE_LIMIT_EXCEEDED",
        message,
        retryAfter,
      });
    }

    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", maxRequests - existing.count);
    next();
  };
}


const roastLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 20,
  message:
    "Too many roast requests. Give GitHub a breather — try again in a minute.",
});

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 25,
  message: "Too many auth attempts. Try again in 15 minutes.",
});

const battleLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 18,
  message: "Too many battle requests. Wait a minute before challenging again.",
});

const generalLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 75,
  message: "Too many requests. Please slow down.",
});

module.exports = {
  roastLimiter,
  authLimiter,
  battleLimiter,
  generalLimiter,
  createRateLimiter,
};
