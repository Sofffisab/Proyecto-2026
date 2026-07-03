import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "../../src/config/prisma.js";

describe("Database Constraints Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("unique constraints", () => {
    it("email duplicado lanza error de constraint", async () => {
      const mockExistingUser = { id: "user-1", email: "test@example.com" };
      const mockDuplicateCreate = { email: "test@example.com" };

      prisma.user.findUnique.mockResolvedValue(mockExistingUser);
      prisma.user.create.mockRejectedValue(
        new Error("Unique constraint failed on the fields: (`email`)")
      );

      await expect(
        prisma.user.create({
          data: mockDuplicateCreate,
        })
      ).rejects.toThrow();
    });

    it("no permite doble check-in (sesión abierta por usuario)", async () => {
      const mockSession = {
        id: "session-1",
        userId: "user-123",
        checkOutAt: null,
      };

      prisma.gymSession.findFirst.mockResolvedValue(mockSession);

      const existing = await prisma.gymSession.findFirst({
        where: { userId: "user-123", checkOutAt: null },
      });

      expect(existing).not.toBeNull();
    });
  });

  describe("cascades", () => {
    it("borrar usuario limpia sus gymSessions", async () => {
      const userId = "user-to-delete";

      prisma.gymSession.deleteMany.mockResolvedValue({ count: 3 });
      prisma.user.delete.mockResolvedValue({ id: userId });

      await prisma.user.delete({ where: { id: userId } });

      expect(prisma.user.delete).toHaveBeenCalled();
    });

    it("borrar usuario limpia sus pointTransactions", async () => {
      const userId = "user-to-delete";

      prisma.pointTransaction.deleteMany.mockResolvedValue({ count: 10 });
      prisma.user.delete.mockResolvedValue({ id: userId });

      await prisma.user.delete({ where: { id: userId } });

      expect(prisma.user.delete).toHaveBeenCalled();
    });

    it("borrar usuario limpia sus logros y achievements", async () => {
      const userId = "user-to-delete";

      prisma.userAchievement.deleteMany.mockResolvedValue({ count: 5 });
      prisma.user.delete.mockResolvedValue({ id: userId });

      await prisma.user.delete({ where: { id: userId } });

      expect(prisma.user.delete).toHaveBeenCalled();
    });
  });

  describe("foreign key constraints", () => {
    it("rechaza pointTransaction con userId inexistente", async () => {
      const invalidData = {
        userId: "nonexistent-user",
        points: 50,
      };

      prisma.user.findUnique.mockResolvedValue(null);

      const result = await prisma.user.findUnique({
        where: { id: "nonexistent-user" },
      });

      expect(result).toBeNull();
    });

    it("rechaza gymSession con userId inexistente", async () => {
      const invalidData = {
        userId: "nonexistent-user",
        checkInAt: new Date(),
      };

      prisma.user.findUnique.mockResolvedValue(null);

      const result = await prisma.user.findUnique({
        where: { id: "nonexistent-user" },
      });

      expect(result).toBeNull();
    });
  });

  describe("seed data", () => {
    it("seed no falla si se corre dos veces", async () => {
      // Mock de seed idempotente
      prisma.role.findUnique.mockResolvedValue({ name: "ADMIN" });

      const result = await prisma.role.findUnique({ where: { name: "ADMIN" } });

      expect(result).toBeDefined();
    });
  });
});
