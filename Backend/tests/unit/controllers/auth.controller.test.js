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

  describe("register", () => {
    it("devuelve 201 con usuario y tokens", async () => {
      req.validatedData = {
        email: "test@example.com",
        password: "password123",
        firstName: "John",
        lastName: "Doe",
      };

      const mockResult = {
        user: { id: "user-123", email: "test@example.com" },
        accessToken: "access_token",
        refreshToken: "refresh_token",
      };

      vi.spyOn(authService, "register").mockResolvedValue(mockResult);

      await authController.register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });

    it("llama next(err) en error", async () => {
      req.validatedData = {
        email: "test@example.com",
        password: "password123",
        firstName: "John",
        lastName: "Doe",
      };

      const error = new Error("Email already in use");
      vi.spyOn(authService, "register").mockRejectedValue(error);

      await authController.register(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("login", () => {
    it("devuelve 200 con tokens", async () => {
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

    it("llama next(err) con credenciales inválidas", async () => {
      req.validatedData = { email: "wrong@example.com", password: "wrongpass" };

      const error = new Error("Invalid credentials");
      vi.spyOn(authService, "login").mockRejectedValue(error);

      await authController.login(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("logout", () => {
    it("devuelve 200 y limpia sesión", async () => {
      req.user = { id: "user-123" };
      req.headers.authorization = "Bearer access_token";

      vi.spyOn(authService, "logout").mockResolvedValue({ success: true });

      await authController.logout(req, res, next);

      expect(authService.logout).toHaveBeenCalledWith("access_token");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { success: true } });
    });
  });

  describe("refreshToken", () => {
    it("devuelve nuevo accessToken", async () => {
      req.validatedData = { refreshToken: "refresh_token" };

      const mockResult = { accessToken: "new_access_token" };

      vi.spyOn(authService, "refreshToken").mockResolvedValue(mockResult);

      await authController.refreshToken(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });

    it("llama next(err) con token inválido", async () => {
      req.validatedData = { refreshToken: "invalid_token" };

      const error = new Error("Invalid token");
      vi.spyOn(authService, "refreshToken").mockRejectedValue(error);

      await authController.refreshToken(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
