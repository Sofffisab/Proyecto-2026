import rateLimit from "express-rate-limit";
import redis from "../config/redis.js";

// The app is deployed on Vercel (serverless): each invocation can land on a
// different / cold instance, so express-rate-limit's default in-memory store
// does NOT reliably share counters across requests. When Upstash Redis is
// configured (same instance already used for the JWT blacklist), back the
// limiter with it so counts are shared across all instances. Falls back to
// the in-memory store locally / when Redis isn't configured.
function redisStore(prefix) {
  // Guard against any redis stub/mock that's truthy but doesn't actually
  // implement the atomic counter methods we need (e.g. the global test
  // mock only provides get/set/setex/del) — fall back to the in-memory
  // store rather than crashing every request with a 500.
  if (!redis || typeof redis.incr !== "function" || typeof redis.expire !== "function") {
    return undefined;
  }

  return {
    async increment(key) {
      const redisKey = `ratelimit:${prefix}:${key}`;
      const totalHits = await redis.incr(redisKey);
      if (totalHits === 1) {
        await redis.expire(redisKey, 15 * 60);
      }
      const ttl = await redis.ttl(redisKey);
      return {
        totalHits,
        resetTime: new Date(Date.now() + Math.max(ttl, 0) * 1000),
      };
    },
    async decrement(key) {
      await redis.decr(`ratelimit:${prefix}:${key}`);
    },
    async resetKey(key) {
      await redis.del(`ratelimit:${prefix}:${key}`);
    },
  };
}

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore("auth"),
  message: {
    success: false,
    message: "Too many authentication attempts",
  },
});

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore("api"),
  // After authenticate runs, key on the user ID so limits are per-user
  // not per-IP (prevents shared-IP abuse and unfair blocking)
  keyGenerator: (req) => req.user?.id || req.ip,
  message: {
    success: false,
    message: "Too many requests",
  },
});

export default {
  authRateLimiter,
  apiRateLimiter,
};