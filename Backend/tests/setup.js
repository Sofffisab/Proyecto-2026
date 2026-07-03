import { vi } from "vitest";

// ==============================
// Environment
// ==============================

process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.ALLOWED_ORIGINS = "http://localhost:3000";
process.env.CRON_SECRET = "test-cron-secret";

// ==============================
// Console
// ==============================

vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});

// ==============================
// Prisma
// ==============================

vi.mock("../src/config/prisma.js", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    gym: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    reward: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    redemption: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    pointTransaction: {
      aggregate: vi.fn(),
      create: vi.fn(),
    },
    progress: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    challenge: {
      findMany: vi.fn(),
    },
    routine: {
      findUnique: vi.fn(),
    },
  },
}));

// ==============================
// Redis
// ==============================

vi.mock("../src/config/redis.js", () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    expire: vi.fn(),
  },
}));

// ==============================
// Firebase
// ==============================

vi.mock("../src/config/firebase.js", () => ({
  default: {},
}));

// ==============================
// Ably
// ==============================

vi.mock("../src/config/ably.js", () => ({
  default: {},
}));

// ==============================
// Jobs
// ==============================

vi.mock("../src/jobs/index.js", () => ({
  runJobs: (req, res) => {
    res.status(200).json({
      success: true,
    });
  },
}));
