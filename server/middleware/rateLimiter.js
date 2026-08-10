const requestCounts = new Map();

setInterval(
  () => {
    const now = Date.now();
    for (const [key, data] of requestCounts.entries()) {
      if (data.resetTime < now) {
        requestCounts.delete(key);
      }
    }
  },
  5 * 60 * 1000,
);

function createRateLimiter({
  windowMs = 60 * 1000,
  maxRequests = 10,
  message = "Too many requests. Please slow down.",
} = {}) {
  return function rateLimiter(req, res, next) {
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown";

    const now = Date.now();

    const key = `${ip}:${req.path}`;

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
  maxRequests: 5,
  message:
    "Too many roast requests. Give GitHub a breather — try again in a minute.",
});

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: "Too many auth attempts. Try again in 15 minutes.",
});

const battleLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 3,
  message: "Too many battle requests. Wait a minute before challenging again.",
});

const generalLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60,
  message: "Too many requests. Please slow down.",
});

module.exports = {
  roastLimiter,
  authLimiter,
  battleLimiter,
  generalLimiter,
  createRateLimiter,
};
