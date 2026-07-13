import { vi } from "vitest";

// Environment

process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.ALLOWED_ORIGINS = "http://localhost:3000";
process.env.CRON_SECRET = "test-cron-secret";

// Console

vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});

// Prisma

function createModelMock() {
  const cache = {};
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== "string") return undefined;
        if (!cache[prop]) cache[prop] = vi.fn();
        return cache[prop];
      },
    }
  );
}

function createPrismaMock() {
  const modelCache = {};
  const prismaMock = new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== "string") return undefined;

        if (prop === "$transaction") {
          if (!modelCache.$transaction) {
            modelCache.$transaction = vi.fn((arg) => {
              // Supports both prisma.$transaction(async (tx) => {...})
              // and prisma.$transaction([promise1, promise2]) styles.
              if (typeof arg === "function") return arg(prismaMock);
              return Promise.all(arg);
            });
          }
          return modelCache.$transaction;
        }

        if (prop === "$connect" || prop === "$disconnect") {
          if (!modelCache[prop]) modelCache[prop] = vi.fn().mockResolvedValue(undefined);
          return modelCache[prop];
        }

        if (!modelCache[prop]) modelCache[prop] = createModelMock();
        return modelCache[prop];
      },
    }
  );
  return prismaMock;
}

const prismaMock = createPrismaMock();

vi.mock("../src/config/prisma.js", () => ({
  default: prismaMock,
  prisma: prismaMock,
}));

// Redis

vi.mock("../src/config/redis.js", () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    expire: vi.fn(),
  },
}));

// Firebase

vi.mock("../src/config/firebase.js", () => ({
  default: {},
}));

// Ably

vi.mock("../src/config/ably.js", () => ({
  default: {},
}));

// Jobs

vi.mock("../src/jobs/index.js", () => ({
  runJobs: (req, res) => {
    res.status(200).json({
      success: true,
    });
  },
}));