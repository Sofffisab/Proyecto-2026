import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { authRateLimiter, apiRateLimiter } from "../../../src/middlewares/rateLimiter.js";

// tests/setup.js mocks redis.js without incr/expire/ttl/decr, the exact
// scenario rateLimiter.js guards against — it should fall back to the
// in-memory store instead of crashing every request with a 500.

function buildApp(limiter, { withUser } = {}) {
  const app = express();
  if (withUser) {
    app.use((req, _res, next) => {
      req.user = { id: withUser };
      next();
    });
  }
  app.use(limiter);
  app.get("/", (_req, res) => res.status(200).json({ success: true }));
  return app;
}

describe("rateLimiter middleware", () => {
  describe("authRateLimiter", () => {
    it("allows requests under the limit through", async () => {
      const app = buildApp(authRateLimiter);

      const res = await request(app).get("/");

      expect(res.status).toBe(200);
    });

    it("blocks with a 429 and the custom message once the limit (10) is exceeded", async () => {
      const app = buildApp(authRateLimiter);

      let lastRes;
      for (let i = 0; i < 11; i++) {
        lastRes = await request(app).get("/");
      }

      expect(lastRes.status).toBe(429);
      expect(lastRes.body).toEqual({
        success: false,
        message: "Too many authentication attempts",
      });
    });
  });

  describe("apiRateLimiter", () => {
    it("allows requests under the limit through", async () => {
      const app = buildApp(apiRateLimiter);

      const res = await request(app).get("/");

      expect(res.status).toBe(200);
    });

    it("keys by authenticated user id rather than IP when req.user is set", async () => {
      // Two different "users" sharing the same test-client IP should be
      // tracked independently — this is the whole point of the custom
      // keyGenerator (shared-IP gyms/offices shouldn't share a rate-limit bucket).
      const appUserA = buildApp(apiRateLimiter, { withUser: "user-a" });
      const appUserB = buildApp(apiRateLimiter, { withUser: "user-b" });

      const resA = await request(appUserA).get("/");
      const resB = await request(appUserB).get("/");

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
      // Both got a fresh window (rate-limit-remaining should reflect only
      // their own request, not a shared counter).
      expect(resA.headers["ratelimit-remaining"]).toBe(resB.headers["ratelimit-remaining"]);
    });
  });
});
