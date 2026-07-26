import { describe, it, expect, vi, beforeEach } from "vitest";
import * as authController from "../../../src/controllers/auth.controller.js";
import * as authService from "../../../src/services/auth.service.js";

vi.mock("../../../src/services/auth.service.js");

describe("AuthController", () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      validatedData: {},
      user: null,
      headers: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      cookie: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  describe("login", () => {
    it("returns 200 with tokens", async () => {
      req.validatedData = { email: "test@example.com", password: "password123" };

      const mockResult = {
        user: { id: "user-123", email: "test@example.com" },
        accessToken: "access_token",
        refreshToken: "refresh_token",
      };

      vi.spyOn(authService, "login").mockResolvedValue(mockResult);

      await authController.login(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });

    it("calls next(err) with invalid credentials", async () => {
      req.validatedData = { email: "wrong@example.com", password: "wrongpass" };

      const error = new Error("Invalid credentials");
      vi.spyOn(authService, "login").mockRejectedValue(error);

      await authController.login(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("logout", () => {
    it("returns 200 and clears the session", async () => {
      req.user = { id: "user-123" };
      req.headers.authorization = "Bearer access_token";

      vi.spyOn(authService, "logout").mockResolvedValue({ success: true });

      await authController.logout(req, res, next);

      expect(authService.logout).toHaveBeenCalledWith("access_token");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { success: true } });
    });

    it("passes null when there is no Authorization header", async () => {
      req.headers = {};

      vi.spyOn(authService, "logout").mockResolvedValue({ success: true });

      await authController.logout(req, res, next);

      expect(authService.logout).toHaveBeenCalledWith(null);
    });

    it("calls next(err) on service failure", async () => {
      req.headers.authorization = "Bearer access_token";
      const error = new Error("boom");
      vi.spyOn(authService, "logout").mockRejectedValue(error);

      await authController.logout(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("createUserByAdmin", () => {
    it("returns 201 with the newly created account", async () => {
      req.validatedData = { email: "member@example.com", role: "MEMBER" };
      const mockUser = { id: "user-456", email: "member@example.com", role: "MEMBER" };

      vi.spyOn(authService, "createUserByAdmin").mockResolvedValue(mockUser);

      await authController.createUserByAdmin(req, res, next);

      expect(authService.createUserByAdmin).toHaveBeenCalledWith(req.validatedData);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUser });
    });

    it("calls next(err) when the email is already taken", async () => {
      req.validatedData = { email: "dup@example.com" };
      const error = new Error("Email already in use");
      vi.spyOn(authService, "createUserByAdmin").mockRejectedValue(error);

      await authController.createUserByAdmin(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("forgotPassword", () => {
    it("returns 200 with the service result", async () => {
      req.validatedData = { email: "test@example.com" };
      const mockResult = { success: true, message: "Email sent" };

      vi.spyOn(authService, "forgotPassword").mockResolvedValue(mockResult);

      await authController.forgotPassword(req, res, next);

      expect(authService.forgotPassword).toHaveBeenCalledWith(req.validatedData);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });

    it("calls next(err) on service failure", async () => {
      req.validatedData = { email: "test@example.com" };
      const error = new Error("boom");
      vi.spyOn(authService, "forgotPassword").mockRejectedValue(error);

      await authController.forgotPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("verifyResetCode", () => {
    it("returns 200 with the service result", async () => {
      req.validatedData = { email: "test@example.com", code: "123456" };
      const mockResult = { valid: true };

      vi.spyOn(authService, "verifyResetCode").mockResolvedValue(mockResult);

      await authController.verifyResetCode(req, res, next);

      expect(authService.verifyResetCode).toHaveBeenCalledWith(req.validatedData);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });

    it("calls next(err) with an invalid or expired code", async () => {
      req.validatedData = { email: "test@example.com", code: "000000" };
      const error = new Error("Invalid or expired code");
      vi.spyOn(authService, "verifyResetCode").mockRejectedValue(error);

      await authController.verifyResetCode(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("resetPassword", () => {
    it("returns 200 when the password is reset successfully", async () => {
      req.validatedData = { token: "reset-token", password: "newPassword123" };
      const mockResult = { success: true };

      vi.spyOn(authService, "resetPassword").mockResolvedValue(mockResult);

      await authController.resetPassword(req, res, next);

      expect(authService.resetPassword).toHaveBeenCalledWith(req.validatedData);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });

    it("calls next(err) with an invalid or expired token", async () => {
      req.validatedData = { token: "invalid-token", password: "newPassword123" };
      const error = new Error("Invalid or expired token");
      vi.spyOn(authService, "resetPassword").mockRejectedValue(error);

      await authController.resetPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("refreshToken", () => {
    it("returns a new accessToken", async () => {
      req.validatedData = { refreshToken: "refresh_token" };

      const mockResult = { accessToken: "new_access_token" };

      vi.spyOn(authService, "refreshToken").mockResolvedValue(mockResult);

      await authController.refreshToken(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });

    it("calls next(err) with an invalid token", async () => {
      req.validatedData = { refreshToken: "invalid_token" };

      const error = new Error("Invalid token");
      vi.spyOn(authService, "refreshToken").mockRejectedValue(error);

      await authController.refreshToken(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
