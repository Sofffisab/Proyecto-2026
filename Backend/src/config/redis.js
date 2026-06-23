import { Redis } from "@upstash/redis";

let redis = null;

/**
 * Redis es opcional — si no está configurado, el sistema sigue funcionando
 * sin revocación de tokens (stateless JWT fallback).
 */
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  console.log("[redis] Connected to Upstash Redis");
} else {
  // Bug 34: make the security impact explicit at startup so ops teams are
  // never silently running without token revocation in production.
  console.warn(
    "[redis] WARNING: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set.\n" +
    "         Token blacklist is DISABLED — logout will NOT invalidate JWT tokens.\n" +
    "         Set the Upstash environment variables to enable secure logout."
  );
}

export default redis;