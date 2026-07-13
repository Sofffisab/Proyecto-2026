import { describe, it, expect } from "vitest";
import { prisma, redis } from "../../../src/config/index.js";
import prismaDefault from "../../../src/config/prisma.js";
import redisDefault from "../../../src/config/redis.js";

describe("config/index.js", () => {
  it("re-exports the same prisma instance as config/prisma.js", () => {
    expect(prisma).toBe(prismaDefault);
  });

  it("re-exports the same redis instance as config/redis.js", () => {
    expect(redis).toBe(redisDefault);
  });
});
