import { describe, it, expect, beforeEach, vi } from "vitest";
import * as userController from "../../../src/controllers/user.controller.js";
import * as userService from "../../../src/services/user.service.js";
import redis from "../../../src/config/redis.js";

vi.mock("../../../src/services/user.service.js");
vi.mock("../../../src/config/redis.js", () => ({
  default: { del: vi.fn() },
}));

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
    it("updates the profile, invalidates the redis cache and responds", async () => {
      req.validatedData = { firstName: "New Name" };
      const mockUpdated = { id: "user-1", firstName: "New Name" };
      vi.spyOn(userService, "update").mockResolvedValue(mockUpdated);

      await userController.updateMe(req, res, next);

      expect(userService.update).toHaveBeenCalledWith("user-1", req.validatedData);
      expect(redis.del).toHaveBeenCalledWith("user:user-1");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUpdated });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("update failed");
      vi.spyOn(userService, "update").mockRejectedValue(error);

      await userController.updateMe(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("updateFcmToken", () => {
    it("updates the token and invalidates cache", async () => {
      req.validatedData = { fcmToken: "token-abc" };
      const mockUpdated = { id: "user-1", fcmToken: "token-abc" };
      vi.spyOn(userService, "updateFcmToken").mockResolvedValue(mockUpdated);

      await userController.updateFcmToken(req, res, next);

      expect(userService.updateFcmToken).toHaveBeenCalledWith("user-1", "token-abc");
      expect(redis.del).toHaveBeenCalledWith("user:user-1");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUpdated });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("fcm failed");
      req.validatedData = { fcmToken: "bad" };
      vi.spyOn(userService, "updateFcmToken").mockRejectedValue(error);

      await userController.updateFcmToken(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getUsers", () => {
    it("uses default limit/offset when query params are absent", async () => {
      const mockUsers = [{ id: "1" }, { id: "2" }];
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
      const error = new Error("db down");
      vi.spyOn(userService, "getAll").mockRejectedValue(error);

      await userController.getUsers(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getUserById", () => {
    it("returns the user when found", async () => {
      req.params.id = "user-2";
      const mockUser = { id: "user-2" };
      vi.spyOn(userService, "getById").mockResolvedValue(mockUser);

      await userController.getUserById(req, res, next);

      expect(userService.getById).toHaveBeenCalledWith("user-2", "USER");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUser });
    });

    it("returns 404 when the user is not found", async () => {
      req.params.id = "missing";
      vi.spyOn(userService, "getById").mockResolvedValue(null);

      await userController.getUserById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: "User not found" });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("boom");
      vi.spyOn(userService, "getById").mockRejectedValue(error);

      await userController.getUserById(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getTrainers", () => {
    it("returns the list of trainers", async () => {
      const mockTrainers = [{ id: "t1" }];
      vi.spyOn(userService, "getTrainers").mockResolvedValue(mockTrainers);

      await userController.getTrainers(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockTrainers });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("boom");
      vi.spyOn(userService, "getTrainers").mockRejectedValue(error);

      await userController.getTrainers(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getTrainerById", () => {
    it("returns the trainer when found", async () => {
      req.params.id = "t1";
      const mockTrainer = { id: "t1" };
      vi.spyOn(userService, "getTrainerById").mockResolvedValue(mockTrainer);

      await userController.getTrainerById(req, res, next);

      expect(userService.getTrainerById).toHaveBeenCalledWith("t1");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockTrainer });
    });

    it("returns 404 when the trainer is not found", async () => {
      req.params.id = "missing";
      vi.spyOn(userService, "getTrainerById").mockResolvedValue(null);

      await userController.getTrainerById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: "Trainer not found" });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("boom");
      vi.spyOn(userService, "getTrainerById").mockRejectedValue(error);

      await userController.getTrainerById(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("changeRole", () => {
    beforeEach(() => {
      req.params.id = "target-1";
      req.validatedData = { role: "TRAINER" };
    });

    it("returns 403 when an admin attempts to change their own role", async () => {
      req.params.id = "user-1"; // same as req.user.id

      await userController.changeRole(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "You cannot change your own role. Ask another admin.",
      });
      expect(userService.getById).not.toHaveBeenCalled();
    });

    it("returns 404 when the target user does not exist", async () => {
      vi.spyOn(userService, "getById").mockResolvedValue(null);

      await userController.changeRole(req, res, next);

      expect(userService.getById).toHaveBeenCalledWith("target-1", "ADMIN");
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: "User not found" });
    });

    it("returns 409 when target is ADMIN and confirm is not provided", async () => {
      vi.spyOn(userService, "getById").mockResolvedValue({ id: "target-1", role: "ADMIN" });

      await userController.changeRole(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message:
          "Target user is an ADMIN. To change an admin's role, resend the request with ?confirm=true.",
      });
      expect(userService.updateRole).not.toHaveBeenCalled();
    });

    it("proceeds when target is ADMIN and confirm=true is provided", async () => {
      req.query.confirm = "true";
      vi.spyOn(userService, "getById").mockResolvedValue({ id: "target-1", role: "ADMIN" });
      const updatedUser = { id: "target-1", role: "TRAINER" };
      vi.spyOn(userService, "updateRole").mockResolvedValue(updatedUser);

      await userController.changeRole(req, res, next);

      expect(userService.updateRole).toHaveBeenCalledWith("target-1", "TRAINER");
      expect(redis.del).toHaveBeenCalledWith("user:target-1");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: updatedUser });
    });

    it("updates the role directly when target is not an admin", async () => {
      vi.spyOn(userService, "getById").mockResolvedValue({ id: "target-1", role: "USER" });
      const updatedUser = { id: "target-1", role: "TRAINER" };
      vi.spyOn(userService, "updateRole").mockResolvedValue(updatedUser);

      await userController.changeRole(req, res, next);

      expect(userService.updateRole).toHaveBeenCalledWith("target-1", "TRAINER");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: updatedUser });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("boom");
      vi.spyOn(userService, "getById").mockRejectedValue(error);

      await userController.changeRole(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("deactivate", () => {
    it("deactivates the target user and invalidates cache", async () => {
      req.params.id = "target-1";
      const mockUser = { id: "target-1", active: false };
      vi.spyOn(userService, "deactivateUser").mockResolvedValue(mockUser);

      await userController.deactivate(req, res, next);

      expect(userService.deactivateUser).toHaveBeenCalledWith("target-1");
      expect(redis.del).toHaveBeenCalledWith("user:target-1");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUser });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("boom");
      vi.spyOn(userService, "deactivateUser").mockRejectedValue(error);

      await userController.deactivate(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("deactivateSelf", () => {
    it("deactivates the authenticated user and invalidates cache", async () => {
      const mockUser = { id: "user-1", active: false };
      vi.spyOn(userService, "deactivateUser").mockResolvedValue(mockUser);

      await userController.deactivateSelf(req, res, next);

      expect(userService.deactivateUser).toHaveBeenCalledWith("user-1");
      expect(redis.del).toHaveBeenCalledWith("user:user-1");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUser });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("boom");
      vi.spyOn(userService, "deactivateUser").mockRejectedValue(error);

      await userController.deactivateSelf(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("deleteSelf", () => {
    it("deletes the authenticated user's account", async () => {
      vi.spyOn(userService, "deleteUser").mockResolvedValue(undefined);

      await userController.deleteSelf(req, res, next);

      expect(userService.deleteUser).toHaveBeenCalledWith("user-1");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { deleted: true } });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("boom");
      vi.spyOn(userService, "deleteUser").mockRejectedValue(error);

      await userController.deleteSelf(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
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

  describe("updateNotificationPreferences", () => {
    it("always uses req.user.id, ignoring req.params.id, and invalidates cache", async () => {
      req.params.id = "some-other-id";
      req.validatedData = { push: false };
      const mockSettings = { push: false };
      vi.spyOn(userService, "updateNotificationPreferences").mockResolvedValue(mockSettings);

      await userController.updateNotificationPreferences(req, res, next);

      expect(userService.updateNotificationPreferences).toHaveBeenCalledWith(
        "user-1",
        req.validatedData
      );
      expect(redis.del).toHaveBeenCalledWith("user:user-1");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockSettings });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("boom");
      vi.spyOn(userService, "updateNotificationPreferences").mockRejectedValue(error);

      await userController.updateNotificationPreferences(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("upsertTrainerProfile", () => {
    beforeEach(() => {
      req.params.id = "trainer-1";
      req.validatedData = { specialty: "Strength" };
    });

    it("returns 404 when the target user does not exist", async () => {
      vi.spyOn(userService, "getById").mockResolvedValue(null);

      await userController.upsertTrainerProfile(req, res, next);

      expect(userService.getById).toHaveBeenCalledWith("trainer-1", "USER");
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: "User not found" });
      expect(userService.upsertTrainerProfile).not.toHaveBeenCalled();
    });

    it("creates/updates the trainer profile when the target user exists", async () => {
      vi.spyOn(userService, "getById").mockResolvedValue({ id: "trainer-1", role: "TRAINER" });
      const mockProfile = { userId: "trainer-1", specialty: "Strength" };
      vi.spyOn(userService, "upsertTrainerProfile").mockResolvedValue(mockProfile);

      await userController.upsertTrainerProfile(req, res, next);

      expect(userService.upsertTrainerProfile).toHaveBeenCalledWith("trainer-1", "Strength");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockProfile });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("boom");
      vi.spyOn(userService, "getById").mockRejectedValue(error);

      await userController.upsertTrainerProfile(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
