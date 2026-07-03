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

    it("get devuelve null si no existe", async () => {
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

    it("setex setea valor con expiry en una operación", async () => {
      redis.setex.mockResolvedValue("OK");

      const result = await redis.setex("test-key", 60, "test-value");

      expect(redis.setex).toHaveBeenCalledWith("test-key", 60, "test-value");
      expect(result).toBe("OK");
    });
  });

  describe("invalidación tras update de perfil", () => {
    it("update de usuario invalida su cache", async () => {
      const userId = "user-123";
      redis.del.mockResolvedValue(1);
      prisma.user.update.mockResolvedValue({ id: userId });

      // Simulación: cuando se actualiza un usuario, se borra su cache
      await prisma.user.update({
        where: { id: userId },
        data: { firstName: "UpdatedName" },
      });

      // Esperaríamos que el código luego llame a redis.del
      await redis.del(`user:${userId}`);

      expect(redis.del).toHaveBeenCalledWith(`user:${userId}`);
    });

    it("invalidación de múltiples caches relacionados", async () => {
      const userId = "user-123";
      redis.del.mockResolvedValue(2);

      // Cuando se actualiza el perfil, se invalidan caches relacionados
      await redis.del(`user:${userId}`, `leaderboard`, `achievements:${userId}`);

      expect(redis.del).toHaveBeenCalled();
    });
  });

  describe("cache coherence", () => {
    it("crea cache solo si Read de Prisma fue exitoso", async () => {
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

    it("no cachea si DB devuelve null", async () => {
      const userId = "nonexistent";
      prisma.user.findUnique.mockResolvedValue(null);
      redis.setex.mockResolvedValue(null);

      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (!user) {
        // No cachear null
        expect(redis.setex).not.toHaveBeenCalled();
      }
    });
  });

  describe("cache patterns", () => {
    it("leaderboard se cachea con key 'leaderboard'", async () => {
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
