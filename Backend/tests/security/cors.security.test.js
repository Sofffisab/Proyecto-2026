import { describe, it, expect, vi } from "vitest";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.ALLOWED_ORIGINS =
  "http://localhost:3000,http://localhost:5173";

vi.mock("../../src/config/prisma.js", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../../src/config/redis.js", () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
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

import app from "../../src/server.js";

describe("CORS Security", () => {
  it("allows the first configured origin", async () => {
    const res = await request(app)
      .get("/api/v1/unknown")
      .set("Origin", "http://localhost:3000");

    expect(res.headers["access-control-allow-origin"])
      .toBe("http://localhost:3000");
  });

  it("allows the second configured origin", async () => {
    const res = await request(app)
      .get("/api/v1/unknown")
      .set("Origin", "http://localhost:5173");

    expect(res.headers["access-control-allow-origin"])
      .toBe("http://localhost:5173");
  });

  it("does not allow an origin outside the whitelist", async () => {
    const res = await request(app)
      .get("/api/v1/unknown")
      .set("Origin", "https://evil.com");

    expect(res.headers["access-control-allow-origin"])
      .toBeUndefined();
  });

  it("returns Access-Control-Allow-Credentials", async () => {
    const res = await request(app)
      .get("/api/v1/unknown")
      .set("Origin", "http://localhost:3000");

    expect(res.headers["access-control-allow-credentials"])
      .toBe("true");
  });

  it("answers preflight OPTIONS requests", async () => {
    const res = await request(app)
      .options("/api/v1/users/me")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "GET");

    expect([200, 204]).toContain(res.status);

    expect(res.headers["access-control-allow-origin"])
      .toBe("http://localhost:3000");
  });

  it("returns allowed HTTP methods", async () => {
    const res = await request(app)
      .options("/api/v1/users/me")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "GET");

    expect(res.headers["access-control-allow-methods"])
      .toContain("GET");

    expect(res.headers["access-control-allow-methods"])
      .toContain("POST");

    expect(res.headers["access-control-allow-methods"])
      .toContain("PUT");

    expect(res.headers["access-control-allow-methods"])
      .toContain("PATCH");

    expect(res.headers["access-control-allow-methods"])
      .toContain("DELETE");
  });

  it("returns allowed headers", async () => {
    const res = await request(app)
      .options("/api/v1/users/me")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "GET");

    expect(res.headers["access-control-allow-headers"])
      .toContain("Authorization");

    expect(res.headers["access-control-allow-headers"])
      .toContain("Content-Type");
  });

  it("returns exposed headers", async () => {
    const res = await request(app)
      .get("/api/v1/unknown")
      .set("Origin", "http://localhost:3000");

    expect(res.headers["access-control-expose-headers"])
      .toContain("X-Total-Count");
  });

  it("returns max-age for preflight cache", async () => {
    const res = await request(app)
      .options("/api/v1/users/me")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "GET");

    expect(res.headers["access-control-max-age"])
      .toBe("86400");
  });
});