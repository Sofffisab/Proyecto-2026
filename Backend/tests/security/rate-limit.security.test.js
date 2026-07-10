import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.ALLOWED_ORIGINS = "http://localhost:3000";
process.env.JWT_ACCESS_SECRET = "test-secret";

vi.mock("../../src/config/prisma.js", () => ({
  default: {
    user: {
      findUnique: vi.fn().mockImplementation(({ where }) =>
        Promise.resolve({
          id: where?.id ?? "user-1",
          isActive: true,
          role: "USER",
        })
      ),
    },
  },
}));

vi.mock("../../src/config/redis.js", () => ({
  default: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn(),
    setex: vi.fn(),
  },
}));

vi.mock("../../src/config/firebase.js", () => ({
  default: {},
}));

vi.mock("../../src/config/ably.js", () => ({
  default: {},
}));

vi.mock("../../src/jobs/index.js", () => ({
  runJobs: (req, res) => res.status(200).json({ success: true }),
}));

import jwt from "jsonwebtoken";
import app from "../../src/server.js";

describe("Rate Limit Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows first authentication requests", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({});

    expect(res.status).not.toBe(429);
  });

  it("blocks login after exceeding authRateLimiter", async () => {
    let response;

    for (let i = 0; i < 11; i++) {
      response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "test@test.com",
          password: "123456",
        });
    }

    expect(response.status).toBe(429);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Too many authentication attempts"
    );
  });

  it("returns RateLimit headers", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({});

    expect(
      Object.keys(res.headers).some((h) =>
        h.toLowerCase().includes("ratelimit")
      )
    ).toBe(true);
  });

  it(
    "limits authenticated API requests",
    async () => {
      const token = jwt.sign(
        {
          userId: "user-1",
        },
        process.env.JWT_ACCESS_SECRET
      );

      let response;

      for (let i = 0; i < 301; i++) {
        response = await request(app)
          .get("/api/v1/users/me")
          .set("Authorization", `Bearer ${token}`);
      }

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "Too many requests"
      );
    },
    // 301 sequential real HTTP requests is inherently slow, and gets slower
    // still under `--coverage` (v8 instruments every executed line). The
    // default 5000ms test timeout is tuned for normal `npm test` runs, not
    // for this one intentionally-heavy test — give it real headroom instead.
    20000
  );

  it("does not rate limit different users together", async () => {
    const token1 = jwt.sign(
      {
        userId: "user-3",
      },
      process.env.JWT_ACCESS_SECRET
    );

    const token2 = jwt.sign(
      {
        userId: "user-4",
      },
      process.env.JWT_ACCESS_SECRET
    );

    const res1 = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${token1}`);

    const res2 = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${token2}`);

    expect(res1.status).not.toBe(429);
    expect(res2.status).not.toBe(429);
  });

  it("includes Retry-After or RateLimit headers when blocked", async () => {
    let response;

    for (let i = 0; i < 11; i++) {
      response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "test@test.com",
          password: "123456",
        });
    }

    expect(response.status).toBe(429);

    const headers = Object.keys(response.headers);

    expect(
      headers.some(
        (h) =>
          h.toLowerCase() === "retry-after" ||
          h.toLowerCase().includes("ratelimit")
      )
    ).toBe(true);
  });
});