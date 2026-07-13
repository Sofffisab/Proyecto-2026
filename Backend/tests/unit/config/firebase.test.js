import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.unmock("../../../src/config/firebase.js");

const initializeAppMock = vi.fn(() => ({ name: "test-app" }));
const certMock = vi.fn((opts) => opts);
const appMock = vi.fn(() => ({ name: "existing-app" }));

vi.mock("firebase-admin", () => ({
  default: {
    apps: [],
    initializeApp: (...args) => initializeAppMock(...args),
    credential: { cert: (...args) => certMock(...args) },
    app: (...args) => appMock(...args),
  },
}));

const loggerInfoMock = vi.fn();
const loggerWarnMock = vi.fn();
vi.mock("../../../src/utils/logger.js", () => ({
  logger: { info: loggerInfoMock, warn: loggerWarnMock },
}));

describe("config/firebase.js", () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("initializes the app and logs success when all Firebase env vars are set", async () => {
    process.env.FIREBASE_PROJECT_ID = "proj";
    process.env.FIREBASE_CLIENT_EMAIL = "sa@proj.iam.gserviceaccount.com";
    process.env.FIREBASE_PRIVATE_KEY = "line1\\nline2";

    vi.doMock("firebase-admin", () => ({
      default: {
        apps: [],
        initializeApp: (...args) => initializeAppMock(...args),
        credential: { cert: (...args) => certMock(...args) },
        app: (...args) => appMock(...args),
      },
    }));

    const { firebase } = await import("../../../src/config/firebase.js");

    expect(certMock).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "proj", clientEmail: "sa@proj.iam.gserviceaccount.com" })
    );
    // The literal \n in the env var must be converted to a real newline.
    expect(certMock.mock.calls[0][0].privateKey).toBe("line1\nline2");
    expect(initializeAppMock).toHaveBeenCalled();
    expect(firebase).toEqual({ name: "test-app" });
    expect(loggerInfoMock).toHaveBeenCalledWith(expect.stringContaining("Initialized"));
  });

  it("reuses the existing app instead of re-initializing when one already exists", async () => {
    process.env.FIREBASE_PROJECT_ID = "proj";
    process.env.FIREBASE_CLIENT_EMAIL = "sa@proj.iam.gserviceaccount.com";
    process.env.FIREBASE_PRIVATE_KEY = "key";

    vi.doMock("firebase-admin", () => ({
      default: {
        apps: [{ name: "existing-app" }],
        initializeApp: (...args) => initializeAppMock(...args),
        credential: { cert: (...args) => certMock(...args) },
        app: (...args) => appMock(...args),
      },
    }));

    const { firebase } = await import("../../../src/config/firebase.js");

    expect(initializeAppMock).not.toHaveBeenCalled();
    expect(appMock).toHaveBeenCalled();
    expect(firebase).toEqual({ name: "existing-app" });
  });

  it("exports null and logs a warning (push notifications unavailable) when env vars are missing", async () => {
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;

    const { firebase } = await import("../../../src/config/firebase.js");

    expect(firebase).toBeNull();
    expect(loggerWarnMock).toHaveBeenCalledWith(
      expect.stringContaining("Push notifications unavailable"),
      expect.any(String)
    );
  });
});
