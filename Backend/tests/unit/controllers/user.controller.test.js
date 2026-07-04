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
    it("retorna 200 con el perfil del usuario", async () => {
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
    it("actualiza el perfil y llama a userService.update", async () => {
      req.validatedData = { firstName: "New Name" };
      const mockUpdated = { id: "user-1", firstName: "New Name" };
      vi.spyOn(userService, "update").mockResolvedValue(mockUpdated);

      await userController.updateMe(req, res, next);

      expect(userService.update).toHaveBeenCalledWith("user-1", req.validatedData);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUpdated });
    });
  });

  describe("changePassword", () => {
    it("valida credenciales antiguas y responde con mensaje de éxito", async () => {
      req.validatedData = { currentPassword: "old", newPassword: "new" };
      vi.spyOn(userService, "changePassword").mockResolvedValue(undefined);

      await userController.changePassword(req, res, next);

      expect(userService.changePassword).toHaveBeenCalledWith("user-1", req.validatedData);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: "Password updated" });
    });

    it("llama next(err) si las credenciales son inválidas", async () => {
      req.validatedData = { currentPassword: "wrong", newPassword: "new" };
      const error = new Error("Invalid current password");
      vi.spyOn(userService, "changePassword").mockRejectedValue(error);

      await userController.changePassword(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
