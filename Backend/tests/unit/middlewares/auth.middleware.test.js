import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import { authenticate } from "../../../src/middlewares/auth.middleware.js";
import prisma from "../../../src/config/prisma.js";
import redis from "../../../src/config/redis.js";

// Explicit local mock to make sure Redis calls are tracked in this unit test environment
vi.mock("../../../src/config/redis.js", () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(() => Promise.resolve("OK")),
    del: vi.fn(),
    expire: vi.fn(),
  },
}));

describe("authenticate middleware", () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      headers: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
  });

  it("401 if there is no authorization header", async () => {
    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("401 if the header does not start with 'Bearer '", async () => {
    req.headers.authorization = "Basic token123";

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("401 if the token is on the Redis blacklist", async () => {
    const token = jwt.sign({ userId: "user-123", role: "USER" }, process.env.JWT_ACCESS_SECRET, {
      expiresIn: "15m",
    });
    req.headers.authorization = `Bearer ${token}`;

    redis.get.mockResolvedValue("true"); // Token in blacklist

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("usa cache de Redis (user:<id>) si existe, sin ir a Prisma", async () => {
    const token = jwt.sign({ userId: "user-123", role: "USER" }, process.env.JWT_ACCESS_SECRET, {
      expiresIn: "15m",
    });
    req.headers.authorization = `Bearer ${token}`;

    redis.get.mockImplementation((key) => {
      if (key === "user:user-123") {
        return Promise.resolve(
          JSON.stringify({ id: "user-123", role: "USER", isActive: true })
        );
      }
      return Promise.resolve(null); // not on the blacklist
    });

    await authenticate(req, res, next);

    expect(redis.get).toHaveBeenCalledWith("user:user-123");
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
  });

  it("caches in Redis with a 60s TTL after reading from Prisma", async () => {
    const token = jwt.sign({ userId: "user-123", role: "USER" }, process.env.JWT_ACCESS_SECRET, {
      expiresIn: "15m",
    });
    req.headers.authorization = `Bearer ${token}`;

    redis.get.mockResolvedValue(null); // Not in cache
    prisma.user.findUnique.mockResolvedValue({
      id: "user-123",
      role: "USER",
      isActive: true,
    });

    await authenticate(req, res, next);

    expect(redis.setex).toHaveBeenCalledWith(
      "user:user-123",
      60,
      expect.any(String)
    );
    expect(next).toHaveBeenCalled();
  });

  it("401 if the user does not exist in the DB", async () => {
    const token = jwt.sign({ userId: "user-123", role: "USER" }, process.env.JWT_ACCESS_SECRET, {
      expiresIn: "15m",
    });
    req.headers.authorization = `Bearer ${token}`;

    redis.get.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("403 si user.isActive === false", async () => {
    const token = jwt.sign({ userId: "user-123", role: "USER" }, process.env.JWT_ACCESS_SECRET, {
      expiresIn: "15m",
    });
    req.headers.authorization = `Bearer ${token}`;

    redis.get.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({
      id: "user-123",
      isActive: false,
    });

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("401 if jwt.verify throws (invalid/expired/malformed token)", async () => {
    req.headers.authorization = "Bearer malformed_token";

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("attaches req.user and calls next() in the happy path", async () => {
    const token = jwt.sign({ userId: "user-123", role: "ADMIN" }, process.env.JWT_ACCESS_SECRET, {
      expiresIn: "15m",
    });
    req.headers.authorization = `Bearer ${token}`;

    redis.get.mockImplementation((key) => {
      if (key === "user:user-123") {
        return Promise.resolve(
          JSON.stringify({ id: "user-123", role: "ADMIN", isActive: true })
        );
      }
      return Promise.resolve(null); // not on the blacklist
    });

    await authenticate(req, res, next);

    expect(req.user).toBeDefined();
    expect(req.user.id).toBe("user-123");
    expect(req.user.role).toBe("ADMIN");
    expect(next).toHaveBeenCalled();
  });
});