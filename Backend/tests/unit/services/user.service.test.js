import { describe, it, expect, vi, beforeEach } from "vitest";
import * as userService from "../../../src/services/user.service.js";
import prisma from "../../../src/config/prisma.js";
import redis from "../../../src/config/redis.js";

describe("UserService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUserById", () => {
    it("devuelve perfil, usa cache de Redis si existe", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
      };

      redis.get.mockResolvedValue(JSON.stringify(mockUser));

      const result = await userService.getUserById("user-123");

      expect(redis.get).toHaveBeenCalledWith("user:user-123");
      expect(result).toEqual(mockUser);
    });

    it("lanza error si no existe", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      redis.get.mockResolvedValue(null);

      await expect(userService.getUserById("nonexistent")).rejects.toThrow("not found");
    });
  });

  describe("updateProfile", () => {
    it("actualiza y invalida cache", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        firstName: "Updated",
      };

      prisma.user.update.mockResolvedValue(mockUser);
      redis.del.mockResolvedValue(1);

      const result = await userService.updateProfile("user-123", { firstName: "Updated" });

      expect(result.firstName).toBe("Updated");
      expect(redis.del).toHaveBeenCalledWith("user:user-123");
    });

    it("rechaza email duplicado", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "other-user" });

      await expect(
        userService.updateProfile("user-123", { email: "taken@example.com" })
      ).rejects.toThrow("Email already in use");
    });
  });

  describe("changeRole", () => {
    it("cambia rol correctamente", async () => {
      const mockUser = { id: "user-123", role: "TRAINER" };

      prisma.user.update.mockResolvedValue(mockUser);
      redis.del.mockResolvedValue(1);

      const result = await userService.changeRole("user-123", "TRAINER");

      expect(result.role).toBe("TRAINER");
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-123" },
        data: { role: "TRAINER" },
      });
    });
  });

  describe("deactivate", () => {
    it("desactiva usuario y limpia cache", async () => {
      const mockUser = { id: "user-123", isActive: false };

      prisma.user.update.mockResolvedValue(mockUser);
      redis.del.mockResolvedValue(1);

      const result = await userService.deactivateUser("user-123");

      expect(result.isActive).toBe(false);
      expect(redis.del).toHaveBeenCalledWith("user:user-123");
    });
  });

  describe("upsertTrainerProfile", () => {
    it("crea o actualiza perfil de trainer", async () => {
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

  describe("searchUsers", () => {
    it("filtra y pagina resultados", async () => {
      const mockUsers = [
        { id: "user-1", firstName: "John" },
        { id: "user-2", firstName: "Jane" },
      ];

      prisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await userService.searchUsers({ query: "Jo", limit: 10, offset: 0 });

      expect(result).toHaveLength(2);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          OR: expect.any(Array),
        }),
        take: 10,
        skip: 0,
      });
    });
  });

  describe("getUsers", () => {
    it("lista usuarios con paginación", async () => {
      const mockUsers = Array(5).fill(null).map((_, i) => ({
        id: `user-${i}`,
        email: `user${i}@example.com`,
      }));

      prisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await userService.getUsers({ limit: 5, offset: 0 });

      expect(result).toHaveLength(5);
    });
  });
});
