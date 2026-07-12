import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import * as userService from "../../../src/services/user.service.js";
import prisma from "../../../src/config/prisma.js";
import redis from "../../../src/config/redis.js";

vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

describe("UserService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("update", () => {
    it("marks isProfileComplete true once birthday, medicalConditions and deliveryAddress are all present", async () => {
      prisma.user.findUnique.mockResolvedValue({
        birthday: null,
        medicalConditions: null,
        deliveryAddress: null,
      });
      prisma.user.update.mockResolvedValue({ id: "user-123", isProfileComplete: true });

      await userService.update("user-123", {
        birthday: "1990-01-01T00:00:00.000Z",
        medicalConditions: [],
        deliveryAddress: "Main St 123",
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-123" },
        data: expect.objectContaining({ isProfileComplete: true }),
      });
    });

    it("keeps isProfileComplete false when a required field is still missing", async () => {
      prisma.user.findUnique.mockResolvedValue({
        birthday: new Date("1990-01-01"),
        medicalConditions: null,
        deliveryAddress: null,
      });
      prisma.user.update.mockResolvedValue({ id: "user-123", isProfileComplete: false });

      await userService.update("user-123", { firstName: "Ana" });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-123" },
        data: expect.objectContaining({ isProfileComplete: false }),
      });
    });

    it("strips role/isActive/passwordHash/isProfileComplete from the payload to prevent privilege escalation", async () => {
      prisma.user.findUnique.mockResolvedValue({
        birthday: new Date(),
        medicalConditions: [],
        deliveryAddress: "x",
      });
      prisma.user.update.mockResolvedValue({});

      await userService.update("user-123", {
        firstName: "Ana",
        role: "ADMIN",
        isActive: false,
        passwordHash: "hacked",
        isProfileComplete: false,
      });

      const callArgs = prisma.user.update.mock.calls[0][0];
      expect(callArgs.data).not.toHaveProperty("role");
      expect(callArgs.data).not.toHaveProperty("isActive");
      expect(callArgs.data).not.toHaveProperty("passwordHash");
      expect(callArgs.data.firstName).toBe("Ana");
    });
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

    it("uses default limit/offset when called without arguments", async () => {
      prisma.user.findMany.mockResolvedValue([]);

      await userService.getAll();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20, skip: 0 })
      );
    });
  });

  describe("getById", () => {
    const fullUser = {
      id: "user-123",
      email: "a@a.com",
      passwordHash: "hash",
      passwordResetToken: "token",
      passwordResetExpires: new Date(),
      medicalConditions: ["asthma"],
      objectives: ["lose weight"],
      deliveryAddress: "Main St",
      role: "USER",
    };

    it("returns null when the user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await userService.getById("missing");

      expect(result).toBeNull();
    });

    it("strips sensitive auth fields but keeps personal fields for ADMIN callers", async () => {
      prisma.user.findUnique.mockResolvedValue(fullUser);

      const result = await userService.getById("user-123", "ADMIN");

      expect(result).not.toHaveProperty("passwordHash");
      expect(result).not.toHaveProperty("passwordResetToken");
      expect(result).not.toHaveProperty("passwordResetExpires");
      expect(result).toHaveProperty("medicalConditions");
      expect(result).toHaveProperty("deliveryAddress");
    });

    it("strips sensitive personal fields for non-ADMIN callers", async () => {
      prisma.user.findUnique.mockResolvedValue(fullUser);

      const result = await userService.getById("user-123", "USER");

      expect(result).not.toHaveProperty("passwordHash");
      expect(result).not.toHaveProperty("medicalConditions");
      expect(result).not.toHaveProperty("objectives");
      expect(result).not.toHaveProperty("deliveryAddress");
      expect(result.email).toBe("a@a.com");
    });

    it("defaults to non-admin visibility when no role is provided", async () => {
      prisma.user.findUnique.mockResolvedValue(fullUser);

      const result = await userService.getById("user-123");

      expect(result).not.toHaveProperty("medicalConditions");
    });
  });

  describe("getTrainers", () => {
    it("returns only active trainers", async () => {
      const mockTrainers = [{ id: "t1", role: "TRAINER" }];
      prisma.user.findMany.mockResolvedValue(mockTrainers);

      const result = await userService.getTrainers();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: "TRAINER", isActive: true } })
      );
      expect(result).toEqual(mockTrainers);
    });
  });

  describe("getTrainerById", () => {
    it("returns null when the user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await userService.getTrainerById("missing");

      expect(result).toBeNull();
    });

    it("returns null when the user is not a TRAINER", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "USER" });

      const result = await userService.getTrainerById("u1");

      expect(result).toBeNull();
    });

    it("strips sensitive fields when the user is a TRAINER", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "t1",
        role: "TRAINER",
        passwordHash: "hash",
        passwordResetToken: "tok",
        passwordResetExpires: new Date(),
        medicalConditions: [],
        objectives: [],
        deliveryAddress: "x",
        firstName: "Trainer",
      });

      const result = await userService.getTrainerById("t1");

      expect(result).not.toHaveProperty("passwordHash");
      expect(result).not.toHaveProperty("medicalConditions");
      expect(result.firstName).toBe("Trainer");
    });
  });

  describe("updateFcmToken", () => {
    it("updates the fcm token", async () => {
      prisma.user.update.mockResolvedValue({ id: "user-123", fcmToken: "abc" });

      const result = await userService.updateFcmToken("user-123", "abc");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-123" },
        data: { fcmToken: "abc" },
      });
      expect(result.fcmToken).toBe("abc");
    });
  });

  describe("changePassword", () => {
    it("throws when the user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        userService.changePassword("missing", { currentPassword: "a", newPassword: "b" })
      ).rejects.toThrow("User not found");
    });

    it("throws when the current password is incorrect", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u1", passwordHash: "hash" });
      bcrypt.compare.mockResolvedValue(false);

      await expect(
        userService.changePassword("u1", { currentPassword: "wrong", newPassword: "new" })
      ).rejects.toThrow("Current password is incorrect");
    });

    it("hashes and updates the password when current password is valid", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u1", passwordHash: "hash" });
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue("new-hash");
      prisma.user.update.mockResolvedValue({ id: "u1" });

      await userService.changePassword("u1", { currentPassword: "old", newPassword: "new" });

      expect(bcrypt.hash).toHaveBeenCalledWith("new", 10);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { passwordHash: "new-hash" },
      });
    });
  });

  describe("updateNotificationPreferences", () => {
    it("only forwards defined fields to the upsert call", async () => {
      prisma.userSettings.upsert.mockResolvedValue({ disableAssistance: true });

      await userService.updateNotificationPreferences("u1", {
        disableAssistance: true,
        disableSocial: undefined,
      });

      expect(prisma.userSettings.upsert).toHaveBeenCalledWith({
        where: { userId: "u1" },
        update: { disableAssistance: true },
        create: { userId: "u1", disableAssistance: true },
      });
    });

    it("forwards all provided preference fields", async () => {
      prisma.userSettings.upsert.mockResolvedValue({});

      const data = {
        disableAssistance: false,
        disableSocial: true,
        trainerPreference: "t1",
        machineTrackingOptOut: true,
        analyticsConsent: false,
      };

      await userService.updateNotificationPreferences("u1", data);

      expect(prisma.userSettings.upsert).toHaveBeenCalledWith({
        where: { userId: "u1" },
        update: data,
        create: { userId: "u1", ...data },
      });
    });
  });

  describe("deleteUser", () => {
    it("auto-checks-out an active gym session before deleting", async () => {
      prisma.gymSession.findFirst.mockResolvedValue({ id: "session-1" });
      prisma.gymSession.update.mockResolvedValue({});
      prisma.assistance.findFirst.mockResolvedValue(null);
      prisma.socialChallenge.findFirst.mockResolvedValue(null);
      prisma.user.delete.mockResolvedValue({ id: "u1" });

      await userService.deleteUser("u1");

      expect(prisma.gymSession.update).toHaveBeenCalledWith({
        where: { id: "session-1" },
        data: { checkOutAt: expect.any(Date) },
      });
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: "u1" } });
    });

    it("throws when there are pending assistance requests", async () => {
      prisma.gymSession.findFirst.mockResolvedValue(null);
      prisma.assistance.findFirst.mockResolvedValue({ id: "a1" });

      await expect(userService.deleteUser("u1")).rejects.toThrow(
        "Cannot delete user with pending assistance requests. Resolve them first."
      );
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it("throws when there are active challenges", async () => {
      prisma.gymSession.findFirst.mockResolvedValue(null);
      prisma.assistance.findFirst.mockResolvedValue(null);
      prisma.socialChallenge.findFirst.mockResolvedValue({ id: "c1" });

      await expect(userService.deleteUser("u1")).rejects.toThrow(
        "Cannot delete user with active challenges. Complete or cancel them first."
      );
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it("deletes the user directly when there are no blockers", async () => {
      prisma.gymSession.findFirst.mockResolvedValue(null);
      prisma.assistance.findFirst.mockResolvedValue(null);
      prisma.socialChallenge.findFirst.mockResolvedValue(null);
      prisma.user.delete.mockResolvedValue({ id: "u1" });

      const result = await userService.deleteUser("u1");

      expect(result).toEqual({ id: "u1" });
      expect(prisma.gymSession.update).not.toHaveBeenCalled();
    });
  });

  describe("upsertTrainerProfile", () => {
    it("creates or updates the trainer profile from an array", async () => {
      const mockProfile = { userId: "user-123", specialties: ["weightlifting"] };
      prisma.trainerProfile.upsert.mockResolvedValue(mockProfile);

      const result = await userService.upsertTrainerProfile("user-123", ["weightlifting"]);

      expect(result.userId).toBe("user-123");
      expect(prisma.trainerProfile.upsert).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        update: { specialties: ["weightlifting"] },
        create: { userId: "user-123", specialties: ["weightlifting"] },
      });
    });

    it("wraps a single string specialty in an array", async () => {
      prisma.trainerProfile.upsert.mockResolvedValue({});

      await userService.upsertTrainerProfile("user-123", "Strength");

      expect(prisma.trainerProfile.upsert).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        update: { specialties: ["Strength"] },
        create: { userId: "user-123", specialties: ["Strength"] },
      });
    });

    it("defaults to an empty array when given no specialty", async () => {
      prisma.trainerProfile.upsert.mockResolvedValue({});

      await userService.upsertTrainerProfile("user-123", undefined);

      expect(prisma.trainerProfile.upsert).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        update: { specialties: [] },
        create: { userId: "user-123", specialties: [] },
      });
    });

    it("defaults to an empty array when the object has no specialties field", async () => {
      prisma.trainerProfile.upsert.mockResolvedValue({});

      await userService.upsertTrainerProfile("user-123", {});

      expect(prisma.trainerProfile.upsert).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        update: { specialties: [] },
        create: { userId: "user-123", specialties: [] },
      });
    });
  });
});
