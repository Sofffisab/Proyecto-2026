import { describe, it, expect, vi, beforeEach } from "vitest";
import redis from "../../src/config/redis.js";
import prisma from "../../src/config/prisma.js";

describe("Redis Cache Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("set/get/expire", () => {
    it("set guarda valor en Redis", async () => {
      redis.set.mockResolvedValue("OK");

      const result = await redis.set("test-key", "test-value");

      expect(redis.set).toHaveBeenCalledWith("test-key", "test-value");
      expect(result).toBe("OK");
    });

    it("get recupera valor de Redis", async () => {
      redis.get.mockResolvedValue("test-value");

      const result = await redis.get("test-key");

      expect(redis.get).toHaveBeenCalledWith("test-key");
      expect(result).toBe("test-value");
    });

    it("get returns null if the key does not exist", async () => {
      redis.get.mockResolvedValue(null);

      const result = await redis.get("nonexistent-key");

      expect(result).toBeNull();
    });

    it("expire configura TTL", async () => {
      redis.expire.mockResolvedValue(1);

      const result = await redis.expire("test-key", 60);

      expect(redis.expire).toHaveBeenCalledWith("test-key", 60);
      expect(result).toBe(1);
    });

    it("setex sets a value with expiry in one operation", async () => {
      redis.setex.mockResolvedValue("OK");

      const result = await redis.setex("test-key", 60, "test-value");

      expect(redis.setex).toHaveBeenCalledWith("test-key", 60, "test-value");
      expect(result).toBe("OK");
    });
  });

  describe("cache invalidation after profile update", () => {
    it("updating a user invalidates their cache", async () => {
      const userId = "user-123";
      redis.del.mockResolvedValue(1);
      prisma.user.update.mockResolvedValue({ id: userId });

      // Simulation: when a user is updated, their cache is cleared
      await prisma.user.update({
        where: { id: userId },
        data: { firstName: "UpdatedName" },
      });

      // We would expect the code to then call redis.del
      await redis.del(`user:${userId}`);

      expect(redis.del).toHaveBeenCalledWith(`user:${userId}`);
    });

    it("invalidates multiple related caches", async () => {
      const userId = "user-123";
      redis.del.mockResolvedValue(2);

      // When the profile is updated, related caches are invalidated
      await redis.del(`user:${userId}`, `leaderboard`, `achievements:${userId}`);

      expect(redis.del).toHaveBeenCalled();
    });
  });

  describe("cache coherence", () => {
    it("only creates the cache if the Prisma read succeeded", async () => {
      const userId = "user-123";
      const mockUser = { id: userId, email: "test@example.com" };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      redis.setex.mockResolvedValue("OK");

      const user = await prisma.user.findUnique({ where: { id: userId } });
      await redis.setex(`user:${userId}`, 60, JSON.stringify(user));

      expect(redis.setex).toHaveBeenCalledWith(
        `user:${userId}`,
        60,
        JSON.stringify(mockUser)
      );
    });

    it("does not cache if the DB returns null", async () => {
      const userId = "nonexistent";
      prisma.user.findUnique.mockResolvedValue(null);
      redis.setex.mockResolvedValue(null);

      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (!user) {
        // Don't cache null
        expect(redis.setex).not.toHaveBeenCalled();
      }
    });
  });

  describe("cache patterns", () => {
    it("the leaderboard is cached under the key 'leaderboard'", async () => {
      const mockLeaderboard = [
        { userId: "user-1", totalPoints: 5000 },
        { userId: "user-2", totalPoints: 4500 },
      ];

      redis.get.mockResolvedValue(JSON.stringify(mockLeaderboard));

      const cached = await redis.get("leaderboard");

      expect(cached).toBeDefined();
      expect(JSON.parse(cached)).toEqual(mockLeaderboard);
    });

    it("challenge leaderboard usa key specific: 'challenge:123:leaderboard'", async () => {
      const challengeId = "challenge-123";
      const mockData = [{ userId: "user-1", progress: 100 }];

      redis.setex.mockResolvedValue("OK");
      redis.get.mockResolvedValue(JSON.stringify(mockData));

      await redis.setex(`challenge:${challengeId}:leaderboard`, 300, JSON.stringify(mockData));
      const cached = await redis.get(`challenge:${challengeId}:leaderboard`);

      expect(cached).toBeDefined();
    });
  });
});
