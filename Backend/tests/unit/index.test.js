import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// src/index.js runs startup logic as a top-level side effect on import
// (env check -> process.exit(1) or app.listen). Re-imports fresh per case
// with different process.env, mocking everything so nothing real happens.

vi.mock("dotenv/config", () => ({}));

const listenMock = vi.fn((_port, cb) => {
  if (cb) cb();
  return { close: vi.fn() };
});

vi.mock("../../src/server.js", () => ({
  default: { listen: listenMock },
}));

const loggerErrorMock = vi.fn();
const loggerInfoMock = vi.fn();

vi.mock("../../src/utils/logger.js", () => ({
  logger: { error: loggerErrorMock, info: loggerInfoMock },
}));

const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "FRONTEND_URL",
  "ABLY_API_KEY",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "CRON_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];

function setAllRequiredEnvVars() {
  for (const key of REQUIRED_ENV_VARS) {
    process.env[key] = `test-${key}`;
  }
}

describe("src/index.js (startup bootstrap)", () => {
  let originalEnv;
  let exitSpy;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.clearAllMocks();
    vi.resetModules();
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    exitSpy.mockRestore();
  });

  it("exits with code 1 and logs the missing vars when required env vars are absent", async () => {
    for (const key of REQUIRED_ENV_VARS) {
      delete process.env[key];
    }

    await import("../../src/index.js");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.stringContaining("Missing required environment variables")
    );
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.stringContaining("DATABASE_URL")
    );
  });

  it("exits with code 1 when only some required env vars are missing", async () => {
    setAllRequiredEnvVars();
    delete process.env.CRON_SECRET;
    delete process.env.ABLY_API_KEY;

    await import("../../src/index.js");

    expect(exitSpy).toHaveBeenCalledWith(1);
    const [[missingMessage]] = loggerErrorMock.mock.calls;
    expect(missingMessage).toContain("CRON_SECRET");
    expect(missingMessage).toContain("ABLY_API_KEY");
    expect(missingMessage).not.toContain("DATABASE_URL");
  });

  it("does not exit and starts the server when all required env vars are present", async () => {
    setAllRequiredEnvVars();
    process.env.PORT = "4000";

    await import("../../src/index.js");

    expect(exitSpy).not.toHaveBeenCalled();
    expect(listenMock).toHaveBeenCalledWith("4000", expect.any(Function));
    expect(loggerInfoMock).toHaveBeenCalledWith(
      expect.stringContaining("GYM BACKEND RUNNING")
    );
  });

  it("defaults to port 3000 when PORT is not set", async () => {
    setAllRequiredEnvVars();
    delete process.env.PORT;

    await import("../../src/index.js");

    expect(listenMock).toHaveBeenCalledWith(3000, expect.any(Function));
  });
});
