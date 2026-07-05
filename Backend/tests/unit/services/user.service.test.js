import { describe, it, expect, vi, beforeEach } from "vitest";
import * as userService from "../../../src/services/user.service.js";
import prisma from "../../../src/config/prisma.js";
import redis from "../../../src/config/redis.js";

describe("UserService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateRole", () => {
    it("updates the role correctly", async () => {
      const mockUser = { id: "user-123", role: "TRAINER" };

      prisma.user.update.mockResolvedValue(mockUser);

      const result = await userService.updateRole("user-123", "TRAINER");

      expect(result.role).toBe("TRAINER");
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-123" },
        data: { role: "TRAINER" },
      });
    });
  });

  describe("deactivateUser", () => {
    it("deactivates the user and clears the cache", async () => {
      const mockUser = { id: "user-123", isActive: false };

      prisma.user.update.mockResolvedValue(mockUser);
      redis.del.mockResolvedValue(1);

      const result = await userService.deactivateUser("user-123");

      expect(result.isActive).toBe(false);
      expect(redis.del).toHaveBeenCalledWith("user:user-123");
    });
  });

  describe("upsertTrainerProfile", () => {
    it("creates or updates the trainer profile", async () => {
      const mockProfile = {
        id: "profile-123",
        userId: "user-123",
        specialties: ["weightlifting"],
      };

      prisma.trainerProfile.upsert.mockResolvedValue(mockProfile);

      const result = await userService.upsertTrainerProfile("user-123", {
        specialties: ["weightlifting"],
      });

      expect(result.userId).toBe("user-123");
      expect(prisma.trainerProfile.upsert).toHaveBeenCalled();
    });
  });

  describe("getAll", () => {
    it("lists users with pagination", async () => {
      const mockUsers = Array(5).fill(null).map((_, i) => ({
        id: `user-${i}`,
        email: `user${i}@example.com`,
      }));

      prisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await userService.getAll({ limit: 5, offset: 0 });

      expect(result).toHaveLength(5);
    });
  });
});
