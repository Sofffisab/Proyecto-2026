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
  console.warn("[redis] UPSTASH_REDIS_REST_URL not set — token blacklist disabled");
}

export default redis;