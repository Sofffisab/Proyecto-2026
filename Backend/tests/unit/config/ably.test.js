import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.unmock("../../../src/config/ably.js");

const AblyRestMock = vi.fn(function AblyRest(opts) {
  this.opts = opts;
});

vi.mock("ably", () => ({
  default: { Rest: AblyRestMock },
}));

const loggerInfoMock = vi.fn();
const loggerWarnMock = vi.fn();
vi.mock("../../../src/utils/logger.js", () => ({
  logger: { info: loggerInfoMock, warn: loggerWarnMock },
}));

describe("config/ably.js", () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("exposes the fixed set of channel names regardless of configuration", async () => {
    delete process.env.ABLY_API_KEY;
    const { ABLY_CHANNELS } = await import("../../../src/config/ably.js");

    expect(ABLY_CHANNELS).toEqual({
      PRESENCE: "presence",
      ASSISTANCE: "assistance",
      SOCIAL: "social",
      NOTIFICATIONS: "notifications",
    });
  });

  it("initializes the REST client and logs success when ABLY_API_KEY is set", async () => {
    process.env.ABLY_API_KEY = "test-key";

    const { ably } = await import("../../../src/config/ably.js");

    expect(AblyRestMock).toHaveBeenCalledWith({ key: "test-key" });
    expect(ably).toBeInstanceOf(AblyRestMock);
    expect(loggerInfoMock).toHaveBeenCalledWith(expect.stringContaining("REST client initialized"));
  });

  it("exports null and warns when ABLY_API_KEY is missing", async () => {
    delete process.env.ABLY_API_KEY;

    const { ably } = await import("../../../src/config/ably.js");

    expect(ably).toBeNull();
    expect(AblyRestMock).not.toHaveBeenCalled();
    expect(loggerWarnMock).toHaveBeenCalledWith(
      expect.stringContaining("REST client unavailable"),
      expect.any(String)
    );
  });
});
