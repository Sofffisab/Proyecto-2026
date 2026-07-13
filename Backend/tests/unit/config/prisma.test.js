import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// tests/setup.js globally mocks src/config/prisma.js (a Proxy-based fake
// PrismaClient) so no other test ever opens a real DB connection. To
// exercise this module's own singleton/logging setup, unmock it and stub
// @prisma/client directly.
vi.unmock("../../../src/config/prisma.js");

const PrismaClientMock = vi.fn(function PrismaClient(opts) {
  this.opts = opts;
});

vi.mock("@prisma/client", () => ({
  PrismaClient: PrismaClientMock,
}));

describe("config/prisma.js", () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetModules();
    vi.clearAllMocks();
    delete globalThis.prisma;
  });

  afterEach(() => {
    process.env = originalEnv;
    delete globalThis.prisma;
  });

  it("creates a PrismaClient with only 'error' logging outside development", async () => {
    process.env.NODE_ENV = "test";

    const { default: prisma } = await import("../../../src/config/prisma.js");

    expect(PrismaClientMock).toHaveBeenCalledWith({ log: ["error"] });
    expect(prisma).toBeInstanceOf(PrismaClientMock);
  });

  it("enables query/error/warn logging in development", async () => {
    process.env.NODE_ENV = "development";

    await import("../../../src/config/prisma.js");

    expect(PrismaClientMock).toHaveBeenCalledWith({ log: ["query", "error", "warn"] });
  });

  it("caches the client on globalThis outside production (hot-reload safe)", async () => {
    process.env.NODE_ENV = "development";

    const { default: prisma } = await import("../../../src/config/prisma.js");

    expect(globalThis.prisma).toBe(prisma);
  });

  it("does not cache the client on globalThis in production", async () => {
    process.env.NODE_ENV = "production";

    await import("../../../src/config/prisma.js");

    expect(globalThis.prisma).toBeUndefined();
  });

  it("reuses the cached globalThis client instead of constructing a new one", async () => {
    const cached = { cached: true };
    globalThis.prisma = cached;
    process.env.NODE_ENV = "development";

    const { default: prisma } = await import("../../../src/config/prisma.js");

    expect(prisma).toBe(cached);
    expect(PrismaClientMock).not.toHaveBeenCalled();
  });
});
