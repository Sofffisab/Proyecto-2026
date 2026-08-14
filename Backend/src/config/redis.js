import { Redis } from "@upstash/redis";
import { logger } from "../utils/logger.js";

let redis = null;


if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  // NOTE: the Upstash SDK client is just an HTTP REST wrapper — creating it
  // never actually opens a connection or validates the URL/token, so this
  // log only means "credentials are present in .env", not "Redis is
  // reachable". A stale/deleted Upstash instance or a DNS/network issue
  // will only surface later, on the first real command (see the
  // fail-open handling in middlewares/rateLimiter.js).
  logger.info("[redis] Client configured (Upstash REST) — not yet verified reachable");
  redis
    .ping()
    .then(() => logger.info("[redis] Connected to Upstash Redis"))
    .catch((err) =>
      logger.warn(
        `[redis] WARNING: configured but unreachable right now: ${err.message}\n` +
        "         Check UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN in .env — " +
        "the Upstash instance may be paused/deleted, or the URL may be stale.\n" +
        "         The app will keep running (rate limiting fails open, token blacklist " +
        "is unavailable until Redis is reachable)."
      )
    );
} else {
  logger.warn(
    "[redis] WARNING: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set.\n" +
    "         Token blacklist is DISABLED — logout will NOT invalidate JWT tokens.\n" +
    "         Set the Upstash environment variables to enable secure logout."
  );
}

export default redis;