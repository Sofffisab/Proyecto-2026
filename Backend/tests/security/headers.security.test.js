import { describe, it, expect, vi } from "vitest";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.ALLOWED_ORIGINS = "http://localhost:3000";

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

describe("Helmet Security Headers", () => {
  it("includes X-Content-Type-Options", async () => {
    const res = await request(app).get("/");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("includes X-Frame-Options", async () => {
    const res = await request(app).get("/");

    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });

  it("includes Cross-Origin-Opener-Policy", async () => {
    const res = await request(app).get("/");

    expect(res.headers["cross-origin-opener-policy"]).toBeDefined();
  });

  it("includes Cross-Origin-Resource-Policy", async () => {
    const res = await request(app).get("/");

    expect(res.headers["cross-origin-resource-policy"]).toBeDefined();
  });

  it("includes Referrer-Policy", async () => {
    const res = await request(app).get("/");

    expect(res.headers["referrer-policy"]).toBeDefined();
  });

  it("includes Origin-Agent-Cluster", async () => {
    const res = await request(app).get("/");

    expect(res.headers["origin-agent-cluster"]).toBe("?1");
  });

  it("does not expose X-Powered-By", async () => {
    const res = await request(app).get("/");

    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("does not send Content-Security-Policy because it is disabled", async () => {
    const res = await request(app).get("/");

    expect(res.headers["content-security-policy"]).toBeUndefined();
  });

  it("returns security headers even on 404 responses", async () => {
    const res = await request(app).get("/route-that-does-not-exist");

    expect(res.status).toBe(404);

    expect(res.headers["x-content-type-options"]).toBeDefined();
    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["referrer-policy"]).toBeDefined();
  });

  it("always returns Helmet headers", async () => {
    const res = await request(app).get("/api/v1/unknown");

    expect(res.headers["x-content-type-options"]).toBeDefined();
    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["cross-origin-opener-policy"]).toBeDefined();
    expect(res.headers["cross-origin-resource-policy"]).toBeDefined();
    expect(res.headers["origin-agent-cluster"]).toBeDefined();
    expect(res.headers["referrer-policy"]).toBeDefined();
  });
});