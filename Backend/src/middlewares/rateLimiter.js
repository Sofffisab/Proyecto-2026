import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { redis } from "../config/index.js";
import { logger } from "../utils/logger.js";

// Serverless deploy needs a shared store across instances (Redis) instead
// of express-rate-limit's default in-memory one; falls back locally
function redisStore(prefix) {
  // Fall back to in-memory if redis is a mock without incr/expire
  if (!redis || typeof redis.incr !== "function" || typeof redis.expire !== "function") {
    return undefined;
  }

  return {
    async increment(key) {
      try {
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
      } catch (err) {
        // Fail OPEN, not closed: if Upstash is unreachable (DNS failure,
        // instance paused/deleted, network blip), a rate limiter must
        // never be the reason auth/API requests start 500ing. Log it so
        // it's visible, but let the request through uncounted for this
        // window instead of throwing.
        logger.warn(
          `[rateLimiter] Redis unreachable, allowing request through (prefix="${prefix}"): ${err.message}`
        );
        return { totalHits: 1, resetTime: new Date(Date.now() + 15 * 60 * 1000) };
      }
    },
    async decrement(key) {
      try {
        await redis.decr(`ratelimit:${prefix}:${key}`);
      } catch (err) {
        logger.warn(`[rateLimiter] Redis decrement failed (prefix="${prefix}"): ${err.message}`);
      }
    },
    async resetKey(key) {
      try {
        await redis.del(`ratelimit:${prefix}:${key}`);
      } catch (err) {
        logger.warn(`[rateLimiter] Redis resetKey failed (prefix="${prefix}"): ${err.message}`);
      }
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
  // Key on user ID (post-auth) instead of IP, to avoid shared-IP blocking.
  // Falls back to IP for unauthenticated requests — must go through
  // ipKeyGenerator so IPv6 addresses are normalized per-subnet instead of
  // per-exact-address (otherwise an IPv6 user could bypass the limit by
  // varying the host part of their address). See:
  // https://express-rate-limit.github.io/ERR_ERL_KEY_GEN_IPV6/
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip),
  message: {
    success: false,
    message: "Too many requests",
  },
});

export default {
  authRateLimiter,
  apiRateLimiter,
};