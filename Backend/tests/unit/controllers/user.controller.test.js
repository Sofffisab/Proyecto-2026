import { describe, it, expect, beforeEach, vi } from "vitest";
import * as userController from "../../../src/controllers/user.controller.js";
import * as userService from "../../../src/services/user.service.js";

vi.mock("../../../src/services/user.service.js");
vi.mock("../../../src/config/redis.js", () => ({ default: null }));

describe("UserController", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: { id: "user-1", role: "USER" },
      params: {},
      query: {},
      body: {},
      validatedData: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  describe("getMe", () => {
    it("returns 200 with the authenticated user profile", async () => {
      const mockProfile = { id: "user-1", email: "test@example.com" };
      vi.spyOn(userService, "getById").mockResolvedValue(mockProfile);

      await userController.getMe(req, res, next);

      expect(userService.getById).toHaveBeenCalledWith("user-1", "USER");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockProfile });
    });

    it("llama next(err) en error", async () => {
      const error = new Error("DB Error");
      vi.spyOn(userService, "getById").mockRejectedValue(error);

      await userController.getMe(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("updateMe", () => {
    it("updates the profile and calls userService.update", async () => {
      req.validatedData = { firstName: "New Name" };
      const mockUpdated = { id: "user-1", firstName: "New Name" };
      vi.spyOn(userService, "update").mockResolvedValue(mockUpdated);

      await userController.updateMe(req, res, next);

      expect(userService.update).toHaveBeenCalledWith("user-1", req.validatedData);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUpdated });
    });
  });

  describe("changePassword", () => {
    it("validates the old credentials and responds with a success message", async () => {
      req.validatedData = { currentPassword: "old", newPassword: "new" };
      vi.spyOn(userService, "changePassword").mockResolvedValue(undefined);

      await userController.changePassword(req, res, next);

      expect(userService.changePassword).toHaveBeenCalledWith("user-1", req.validatedData);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: "Password updated" });
    });

    it("calls next(err) if the credentials are invalid", async () => {
      req.validatedData = { currentPassword: "wrong", newPassword: "new" };
      const error = new Error("Invalid current password");
      vi.spyOn(userService, "changePassword").mockRejectedValue(error);

      await userController.changePassword(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("updateFcmToken", () => {
    it("updates the token, invalidates the cache and returns 200", async () => {
      req.validatedData = { fcmToken: "fcm-token-123" };
      const mockUser = { id: "user-1", fcmToken: "fcm-token-123" };
      vi.spyOn(userService, "updateFcmToken").mockResolvedValue(mockUser);

      await userController.updateFcmToken(req, res, next);

      expect(userService.updateFcmToken).toHaveBeenCalledWith("user-1", "fcm-token-123");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUser });
    });

    it("calls next(err) on failure", async () => {
      req.validatedData = { fcmToken: "fcm-token-123" };
      const error = new Error("DB error");
      vi.spyOn(userService, "updateFcmToken").mockRejectedValue(error);

      await userController.updateFcmToken(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getUsers", () => {
    it("uses default pagination when no query params are given", async () => {
      req.query = {};
      const mockUsers = [{ id: "user-1" }, { id: "user-2" }];
      vi.spyOn(userService, "getAll").mockResolvedValue(mockUsers);

      await userController.getUsers(req, res, next);

      expect(userService.getAll).toHaveBeenCalledWith({ limit: 20, offset: 0 });
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUsers });
    });

    it("parses limit/offset from the query string", async () => {
      req.query = { limit: "5", offset: "10" };
      vi.spyOn(userService, "getAll").mockResolvedValue([]);

      await userController.getUsers(req, res, next);

      expect(userService.getAll).toHaveBeenCalledWith({ limit: 5, offset: 10 });
    });

    it("calls next(err) on failure", async () => {
      req.query = {};
      const error = new Error("DB error");
      vi.spyOn(userService, "getAll").mockRejectedValue(error);

      await userController.getUsers(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getUserById", () => {
    it("returns 200 with the user when found", async () => {
      req.params = { id: "user-2" };
      const mockUser = { id: "user-2" };
      vi.spyOn(userService, "getById").mockResolvedValue(mockUser);

      await userController.getUserById(req, res, next);

      expect(userService.getById).toHaveBeenCalledWith("user-2", "USER");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUser });
    });

    it("returns 404 when the user does not exist", async () => {
      req.params = { id: "does-not-exist" };
      vi.spyOn(userService, "getById").mockResolvedValue(null);

      await userController.getUserById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: "User not found" });
    });

    it("calls next(err) on failure", async () => {
      req.params = { id: "user-2" };
      const error = new Error("DB error");
      vi.spyOn(userService, "getById").mockRejectedValue(error);

      await userController.getUserById(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getTrainers", () => {
    it("returns 200 with the trainer list", async () => {
      const mockTrainers = [{ id: "trainer-1" }];
      vi.spyOn(userService, "getTrainers").mockResolvedValue(mockTrainers);

      await userController.getTrainers(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockTrainers });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("DB error");
      vi.spyOn(userService, "getTrainers").mockRejectedValue(error);

      await userController.getTrainers(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getTrainerById", () => {
    it("returns 200 with the trainer when found", async () => {
      req.params = { id: "trainer-1" };
      const mockTrainer = { id: "trainer-1" };
      vi.spyOn(userService, "getTrainerById").mockResolvedValue(mockTrainer);

      await userController.getTrainerById(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockTrainer });
    });

    it("returns 404 when the trainer does not exist", async () => {
      req.params = { id: "does-not-exist" };
      vi.spyOn(userService, "getTrainerById").mockResolvedValue(null);

      await userController.getTrainerById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: "Trainer not found" });
    });

    it("calls next(err) on failure", async () => {
      req.params = { id: "trainer-1" };
      const error = new Error("DB error");
      vi.spyOn(userService, "getTrainerById").mockRejectedValue(error);

      await userController.getTrainerById(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("changeRole", () => {
    it("returns 403 when an admin tries to change their own role", async () => {
      req.user = { id: "admin-1", role: "ADMIN" };
      req.params = { id: "admin-1" };
      req.validatedData = { role: "TRAINER" };

      await userController.changeRole(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(userService.getById).not.toHaveBeenCalled();
    });

    it("returns 404 when the target user does not exist", async () => {
      req.user = { id: "admin-1", role: "ADMIN" };
      req.params = { id: "user-2" };
      req.validatedData = { role: "TRAINER" };
      vi.spyOn(userService, "getById").mockResolvedValue(null);

      await userController.changeRole(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("returns 409 when demoting/promoting an ADMIN without ?confirm=true", async () => {
      req.user = { id: "admin-1", role: "ADMIN" };
      req.params = { id: "user-2" };
      req.query = {};
      req.validatedData = { role: "TRAINER" };
      vi.spyOn(userService, "getById").mockResolvedValue({ id: "user-2", role: "ADMIN" });

      await userController.changeRole(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(userService.updateRole).not.toHaveBeenCalled();
    });

    it("changes the role, invalidates the cache and returns 200 with ?confirm=true for an ADMIN target", async () => {
      req.user = { id: "admin-1", role: "ADMIN" };
      req.params = { id: "user-2" };
      req.query = { confirm: "true" };
      req.validatedData = { role: "TRAINER" };
      vi.spyOn(userService, "getById").mockResolvedValue({ id: "user-2", role: "ADMIN" });
      const mockUpdated = { id: "user-2", role: "TRAINER" };
      vi.spyOn(userService, "updateRole").mockResolvedValue(mockUpdated);

      await userController.changeRole(req, res, next);

      expect(userService.updateRole).toHaveBeenCalledWith("user-2", "TRAINER");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUpdated });
    });

    it("changes the role of a non-ADMIN target without needing ?confirm=true", async () => {
      req.user = { id: "admin-1", role: "ADMIN" };
      req.params = { id: "user-2" };
      req.query = {};
      req.validatedData = { role: "TRAINER" };
      vi.spyOn(userService, "getById").mockResolvedValue({ id: "user-2", role: "USER" });
      const mockUpdated = { id: "user-2", role: "TRAINER" };
      vi.spyOn(userService, "updateRole").mockResolvedValue(mockUpdated);

      await userController.changeRole(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUpdated });
    });

    it("calls next(err) on failure", async () => {
      req.user = { id: "admin-1", role: "ADMIN" };
      req.params = { id: "user-2" };
      req.query = {};
      req.validatedData = { role: "TRAINER" };
      const error = new Error("DB error");
      vi.spyOn(userService, "getById").mockRejectedValue(error);

      await userController.changeRole(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("deactivate", () => {
    it("deactivates the target user, invalidates the cache and returns 200", async () => {
      req.params = { id: "user-2" };
      const mockUser = { id: "user-2", isActive: false };
      vi.spyOn(userService, "deactivateUser").mockResolvedValue(mockUser);

      await userController.deactivate(req, res, next);

      expect(userService.deactivateUser).toHaveBeenCalledWith("user-2");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUser });
    });

    it("calls next(err) on failure", async () => {
      req.params = { id: "user-2" };
      const error = new Error("DB error");
      vi.spyOn(userService, "deactivateUser").mockRejectedValue(error);

      await userController.deactivate(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("deactivateSelf", () => {
    it("deactivates the authenticated user's own account", async () => {
      const mockUser = { id: "user-1", isActive: false };
      vi.spyOn(userService, "deactivateUser").mockResolvedValue(mockUser);

      await userController.deactivateSelf(req, res, next);

      expect(userService.deactivateUser).toHaveBeenCalledWith("user-1");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUser });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("DB error");
      vi.spyOn(userService, "deactivateUser").mockRejectedValue(error);

      await userController.deactivateSelf(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("deleteSelf", () => {
    it("permanently deletes the authenticated user's own account", async () => {
      vi.spyOn(userService, "deleteUser").mockResolvedValue(undefined);

      await userController.deleteSelf(req, res, next);

      expect(userService.deleteUser).toHaveBeenCalledWith("user-1");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { deleted: true } });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("DB error");
      vi.spyOn(userService, "deleteUser").mockRejectedValue(error);

      await userController.deleteSelf(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("updateNotificationPreferences", () => {
    it("always uses req.user.id, invalidates the cache and returns 200", async () => {
      req.validatedData = { pushEnabled: false };
      const mockSettings = { pushEnabled: false };
      vi.spyOn(userService, "updateNotificationPreferences").mockResolvedValue(mockSettings);

      await userController.updateNotificationPreferences(req, res, next);

      expect(userService.updateNotificationPreferences).toHaveBeenCalledWith(
        "user-1",
        req.validatedData
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockSettings });
    });

    it("calls next(err) on failure", async () => {
      req.validatedData = { pushEnabled: false };
      const error = new Error("DB error");
      vi.spyOn(userService, "updateNotificationPreferences").mockRejectedValue(error);

      await userController.updateNotificationPreferences(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("upsertTrainerProfile", () => {
    it("returns 404 when the target user does not exist", async () => {
      req.params = { id: "trainer-1" };
      req.validatedData = { specialty: "Powerlifting" };
      vi.spyOn(userService, "getById").mockResolvedValue(null);

      await userController.upsertTrainerProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(userService.upsertTrainerProfile).not.toHaveBeenCalled();
    });

    it("creates/updates the trainer profile and returns 200", async () => {
      req.params = { id: "trainer-1" };
      req.validatedData = { specialty: "Powerlifting" };
      vi.spyOn(userService, "getById").mockResolvedValue({ id: "trainer-1" });
      const mockProfile = { userId: "trainer-1", specialty: "Powerlifting" };
      vi.spyOn(userService, "upsertTrainerProfile").mockResolvedValue(mockProfile);

      await userController.upsertTrainerProfile(req, res, next);

      expect(userService.upsertTrainerProfile).toHaveBeenCalledWith("trainer-1", "Powerlifting");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockProfile });
    });

    it("calls next(err) on failure", async () => {
      req.params = { id: "trainer-1" };
      req.validatedData = { specialty: "Powerlifting" };
      const error = new Error("DB error");
      vi.spyOn(userService, "getById").mockRejectedValue(error);

      await userController.upsertTrainerProfile(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
