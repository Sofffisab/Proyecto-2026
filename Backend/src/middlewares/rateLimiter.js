import rateLimit from "express-rate-limit";
import { redis } from "../config/index.js";

// Serverless deploy needs a shared store across instances (Redis) instead
// of express-rate-limit's default in-memory one; falls back locally
function redisStore(prefix) {
  // Fall back to in-memory if redis is a mock without incr/expire
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

export { redisStore };

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
  // Key on user ID (post-auth) instead of IP, to avoid shared-IP blocking
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