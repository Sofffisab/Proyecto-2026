import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// server.js warns when NODE_ENV=production and ALLOWED_ORIGINS is unset
// at module-load time, so it must be re-imported (fresh module registry)
// with the env vars set BEFORE the import for each scenario below.

vi.mock("../../src/config/prisma.js", () => ({
  default: { user: { findUnique: vi.fn() } },
}));
vi.mock("../../src/config/redis.js", () => ({ default: { get: vi.fn(), set: vi.fn() } }));
vi.mock("../../src/config/firebase.js", () => ({ default: {} }));
vi.mock("../../src/config/ably.js", () => ({ default: {} }));
vi.mock("../../src/realtime/ably.js", () => ({
  channels: {},
  emitPresenceEvent: vi.fn(),
  emitAssistanceEvent: vi.fn(),
  emitSocialEvent: vi.fn(),
  emitNotificationEvent: vi.fn(),
  emitUserNeedsAttention: vi.fn(),
}));
vi.mock("../../src/jobs/index.js", () => ({
  runJobs: (req, res) => res.status(200).json({ success: true }),
}));
vi.mock("../../src/utils/logger.js", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const ORIGINAL_ENV = { ...process.env };

describe("server.js startup ALLOWED_ORIGINS warning", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  // NOTE: vi.resetModules() resets the module registry, but does NOT
  // guarantee every dependency graph re-evaluates from scratch in every
  // Vitest pool/isolation configuration — in particular the `logger.js`
  // mock singleton (and anything else `server.js` transitively touches at
  // import time) can keep accumulating `.mock.calls` across tests in this
  // file. So instead of relying on that, we explicitly clear the specific
  // spy we care about right before each import, and only assert on the
  // presence/absence of THIS warning's exact text (not "warn was never
  // called for any reason" — unrelated modules like Ably/Firebase may
  // legitimately warn about their own missing config in this test env,
  // and that noise isn't what this test is about).
  async function importServerFresh() {
    const { logger } = await import("../../src/utils/logger.js");
    logger.warn.mockClear();
    await import("../../src/server.js");
    return logger;
  }

  function warnedAboutAllowedOrigins(logger) {
    return logger.warn.mock.calls.some((call) =>
      String(call[0]).includes("ALLOWED_ORIGINS is not set in production")
    );
  }

  it("warns when NODE_ENV=production and ALLOWED_ORIGINS is not set", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOWED_ORIGINS;

    const logger = await importServerFresh();

    expect(warnedAboutAllowedOrigins(logger)).toBe(true);
  });

  it("does not warn when NODE_ENV=production and ALLOWED_ORIGINS IS set", async () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOWED_ORIGINS = "https://example.com";

    const logger = await importServerFresh();

    expect(warnedAboutAllowedOrigins(logger)).toBe(false);
  });

  it("does not warn outside production even without ALLOWED_ORIGINS", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.ALLOWED_ORIGINS;

    const logger = await importServerFresh();

    expect(warnedAboutAllowedOrigins(logger)).toBe(false);
  });
});
