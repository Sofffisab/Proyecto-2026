import { Redis } from "@upstash/redis";
import { logger } from "../utils/logger.js";

let redis = null;


if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  logger.info("[redis] Connected to Upstash Redis");
} else {
  logger.warn(
    "[redis] WARNING: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set.\n" +
    "         Token blacklist is DISABLED — logout will NOT invalidate JWT tokens.\n" +
    "         Set the Upstash environment variables to enable secure logout."
  );
}

export default redis;