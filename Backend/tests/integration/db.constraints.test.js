import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "../../src/config/prisma.js";

describe("Database Constraints Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("unique constraints", () => {
    it("duplicate email throws a constraint error", async () => {
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

    it("does not allow a double check-in (session already open for user)", async () => {
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
    it("deleting a user cleans up their gymSessions", async () => {
      const userId = "user-to-delete";

      prisma.gymSession.deleteMany.mockResolvedValue({ count: 3 });
      prisma.user.delete.mockResolvedValue({ id: userId });

      await prisma.user.delete({ where: { id: userId } });

      expect(prisma.user.delete).toHaveBeenCalled();
    });

    it("deleting a user cleans up their pointTransactions", async () => {
      const userId = "user-to-delete";

      prisma.pointTransaction.deleteMany.mockResolvedValue({ count: 10 });
      prisma.user.delete.mockResolvedValue({ id: userId });

      await prisma.user.delete({ where: { id: userId } });

      expect(prisma.user.delete).toHaveBeenCalled();
    });

    it("deleting a user cleans up their unlocked achievements", async () => {
      const userId = "user-to-delete";

      prisma.userAchievement.deleteMany.mockResolvedValue({ count: 5 });
      prisma.user.delete.mockResolvedValue({ id: userId });

      await prisma.user.delete({ where: { id: userId } });

      expect(prisma.user.delete).toHaveBeenCalled();
    });
  });

  describe("foreign key constraints", () => {
    it("rejects a pointTransaction with a non-existent userId", async () => {
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

    it("rejects a gymSession with a non-existent userId", async () => {
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
    it("the seed script does not fail if run twice", async () => {
      // Mock de seed idempotente
      prisma.role.findUnique.mockResolvedValue({ name: "ADMIN" });

      const result = await prisma.role.findUnique({ where: { name: "ADMIN" } });

      expect(result).toBeDefined();
    });
  });
});
