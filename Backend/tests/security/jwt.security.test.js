import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-secret";
process.env.ALLOWED_ORIGINS = "http://localhost:3000";

const mockUser = {
  id: "user-1",
  isActive: true,
  role: "USER",
};

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

import prisma from "../../src/config/prisma.js";
import redis from "../../src/config/redis.js";
import app from "../../src/server.js";

describe("JWT Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    prisma.user.findUnique.mockResolvedValue(mockUser);

    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue(null);
    redis.setex.mockResolvedValue(null);
  });

  it("rejects request without Authorization header", async () => {
    const res = await request(app)
      .get("/api/v1/users/me");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("rejects malformed Authorization header", async () => {
    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", "Invalid token");

    expect(res.status).toBe(401);
  });

  it("rejects invalid JWT", async () => {
    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", "Bearer abc.def.ghi");

    expect(res.status).toBe(401);
  });

  it("rejects token signed with another secret", async () => {
    const token = jwt.sign(
      { userId: mockUser.id },
      "another-secret"
    );

    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
  });

  it("rejects manipulated payload", async () => {
    const token = jwt.sign(
      {
        userId: "fake-user",
      },
      process.env.JWT_ACCESS_SECRET
    );

    prisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("rejects revoked token", async () => {
    const token = jwt.sign(
      {
        userId: mockUser.id,
      },
      process.env.JWT_ACCESS_SECRET
    );

    redis.get.mockResolvedValueOnce("blacklisted");

    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
  });

  it("rejects disabled account", async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...mockUser,
      isActive: false,
    });

    const token = jwt.sign(
      {
        userId: mockUser.id,
      },
      process.env.JWT_ACCESS_SECRET
    );

    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("accepts valid token", async () => {
    const token = jwt.sign(
      {
        userId: mockUser.id,
      },
      process.env.JWT_ACCESS_SECRET
    );

    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).not.toBe(401);
  });

  it('rejects token using algorithm "none"', async () => {
    const header = Buffer.from(
      JSON.stringify({
        alg: "none",
        typ: "JWT",
      })
    ).toString("base64url");

    const payload = Buffer.from(
      JSON.stringify({
        userId: mockUser.id,
      })
    ).toString("base64url");

    const fakeToken = `${header}.${payload}.`;

    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${fakeToken}`);

    expect(res.status).toBe(401);
  });
});