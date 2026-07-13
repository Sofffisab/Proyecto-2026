import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// tests/setup.js globally mocks redis.js so the suite never touches the
// real Upstash SDK. To exercise this module's own init logic, unmock it
// and re-import fresh with a mocked @upstash/redis per branch.
vi.unmock("../../../src/config/redis.js");

const RedisConstructorMock = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: RedisConstructorMock,
}));

const loggerInfoMock = vi.fn();
const loggerWarnMock = vi.fn();
vi.mock("../../../src/utils/logger.js", () => ({
  logger: { info: loggerInfoMock, warn: loggerWarnMock },
}));

describe("config/redis.js", () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("instantiates an Upstash Redis client and logs success when both env vars are set", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

    const { default: redis } = await import("../../../src/config/redis.js");

    expect(RedisConstructorMock).toHaveBeenCalledWith({
      url: "https://example.upstash.io",
      token: "test-token",
    });
    expect(redis).toBeInstanceOf(RedisConstructorMock);
    expect(loggerInfoMock).toHaveBeenCalledWith(expect.stringContaining("Connected to Upstash Redis"));
  });

  it("exports null and warns (blacklist disabled) when the URL is missing", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

    const { default: redis } = await import("../../../src/config/redis.js");

    expect(redis).toBeNull();
    expect(RedisConstructorMock).not.toHaveBeenCalled();
    expect(loggerWarnMock).toHaveBeenCalledWith(expect.stringContaining("Token blacklist is DISABLED"));
  });

  it("exports null and warns when the token is missing", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { default: redis } = await import("../../../src/config/redis.js");

    expect(redis).toBeNull();
    expect(RedisConstructorMock).not.toHaveBeenCalled();
    expect(loggerWarnMock).toHaveBeenCalled();
  });

  it("exports null when neither env var is set", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { default: redis } = await import("../../../src/config/redis.js");

    expect(redis).toBeNull();
  });
});
