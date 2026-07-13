import { describe, it, expect, vi, beforeEach } from "vitest";

// The global redis.js mock lacks incr/ttl/decr, which makes redisStore()
// fall back to in-memory. To exercise the Redis-backed branch, override
// the mock here with a fuller fake client before importing.

vi.mock("../../../src/config/redis.js", () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
    decr: vi.fn(),
  },
}));

const { redisStore } = await import("../../../src/middlewares/rateLimiter.js");
const redis = (await import("../../../src/config/redis.js")).default;

describe("rateLimiter redisStore (Redis-backed store)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a store object when redis has incr/expire", () => {
    const store = redisStore("auth");
    expect(store).toBeDefined();
    expect(typeof store.increment).toBe("function");
    expect(typeof store.decrement).toBe("function");
    expect(typeof store.resetKey).toBe("function");
  });

  it("returns undefined (in-memory fallback) when redis lacks incr/expire", async () => {
    vi.resetModules();
    vi.doMock("../../../src/config/redis.js", () => ({
      default: { get: vi.fn(), set: vi.fn() },
    }));
    const { redisStore: freshRedisStore } = await import(
      "../../../src/middlewares/rateLimiter.js"
    );
    expect(freshRedisStore("auth")).toBeUndefined();
  });

  it("increment(): calls INCR, sets a 15-minute TTL on the first hit, and returns totalHits/resetTime from TTL", async () => {
    redis.incr.mockResolvedValue(1);
    redis.ttl.mockResolvedValue(900);

    const store = redisStore("auth");
    const result = await store.increment("1.2.3.4");

    expect(redis.incr).toHaveBeenCalledWith("ratelimit:auth:1.2.3.4");
    expect(redis.expire).toHaveBeenCalledWith("ratelimit:auth:1.2.3.4", 15 * 60);
    expect(redis.ttl).toHaveBeenCalledWith("ratelimit:auth:1.2.3.4");
    expect(result.totalHits).toBe(1);
    expect(result.resetTime).toBeInstanceOf(Date);
  });

  it("increment(): does not reset the TTL on subsequent hits", async () => {
    redis.incr.mockResolvedValue(2);
    redis.ttl.mockResolvedValue(500);

    const store = redisStore("api");
    const result = await store.increment("user-1");

    expect(redis.expire).not.toHaveBeenCalled();
    expect(result.totalHits).toBe(2);
  });

  it("increment(): clamps resetTime to now when ttl comes back negative (no expiry set / key missing)", async () => {
    redis.incr.mockResolvedValue(1);
    redis.ttl.mockResolvedValue(-1);

    const before = Date.now();
    const store = redisStore("auth");
    const result = await store.increment("k");

    expect(result.resetTime.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("decrement(): calls DECR on the prefixed key", async () => {
    const store = redisStore("auth");
    await store.decrement("1.2.3.4");
    expect(redis.decr).toHaveBeenCalledWith("ratelimit:auth:1.2.3.4");
  });

  it("resetKey(): calls DEL on the prefixed key", async () => {
    const store = redisStore("api");
    await store.resetKey("user-1");
    expect(redis.del).toHaveBeenCalledWith("ratelimit:api:user-1");
  });
});
