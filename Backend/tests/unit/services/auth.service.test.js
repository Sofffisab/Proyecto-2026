import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import * as authService from "../../../src/services/auth.service.js";
import prisma from "../../../src/config/prisma.js";
import redis from "../../../src/config/redis.js";
import { sendPasswordResetEmail, sendWelcomeEmail } from "../../../src/services/communication.service.js";
import { AppError } from "../../../src/utils/errors.js";

// Explicit local mock to make sure Redis calls are tracked in this unit test environment
vi.mock("../../../src/config/redis.js", () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(() => Promise.resolve("OK")),
    del: vi.fn(),
    expire: vi.fn(),
  },
}));

vi.mock("../../../src/services/communication.service.js");

describe("AuthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("register", () => {
    it("creates a user with a hashed password (bcrypt)", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        passwordHash: "hashed_password",
        firstName: "John",
        lastName: "Doe",
        role: "USER",
        isActive: true,
      };

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);
      vi.spyOn(bcrypt, "hash").mockResolvedValue("hashed_password");

      const result = await authService.register({
        email: "test@example.com",
        password: "password123",
        firstName: "John",
        lastName: "Doe",
      });

      expect(result.user.email).toBe("test@example.com");
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.passwordHash).toBeUndefined();
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: "test@example.com", role: "USER" }),
        })
      );
    });

    it("assigns the USER role by default", async () => {
      const mockUser = { id: "user-123", role: "USER" };
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);
      vi.spyOn(bcrypt, "hash").mockResolvedValue("hashed");

      await authService.register({
        email: "test@example.com",
        password: "pass",
        firstName: "John",
        lastName: "Doe",
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ role: "USER" }),
      });
    });

    it("throws if the email already exists", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "user-123", email: "test@example.com" });

      await expect(
        authService.register({
          email: "test@example.com",
          password: "pass",
          firstName: "John",
          lastName: "Doe",
        })
      ).rejects.toThrow(AppError);
    });
  });

  describe("login", () => {
    it("returns access+refresh tokens with valid credentials", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        passwordHash: "hashed_password",
        role: "USER",
        isActive: true,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      vi.spyOn(bcrypt, "compare").mockResolvedValue(true);

      const result = await authService.login({
        email: "test@example.com",
        password: "password123",
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(jwt.decode(result.accessToken)).toHaveProperty("userId");
    });

    it("throws with an incorrect password", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        passwordHash: "hashed_password",
        isActive: true,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      vi.spyOn(bcrypt, "compare").mockResolvedValue(false);

      await expect(
        authService.login({ email: "test@example.com", password: "wrong" })
      ).rejects.toThrow("Invalid credentials");
    });

    it("throws if the user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({ email: "nonexistent@example.com", password: "pass" })
      ).rejects.toThrow("Invalid credentials");
    });

    it("throws if isActive=false", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        passwordHash: "hashed_password",
        isActive: false,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        authService.login({ email: "test@example.com", password: "password123" })
      ).rejects.toThrow("Invalid credentials");
    });
  });

  describe("refreshToken", () => {
    it("generates a new access token with a valid refresh token", async () => {
      const mockUser = { id: "user-123", role: "USER", isActive: true };
      const refreshToken = jwt.sign({ userId: "user-123" }, process.env.JWT_REFRESH_SECRET, {
        expiresIn: "7d",
      });

      vi.spyOn(jwt, "verify").mockReturnValue({ userId: "user-123" });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.refreshToken(refreshToken);

      expect(result.accessToken).toBeDefined();
      expect(jwt.decode(result.accessToken)).toHaveProperty("userId", "user-123");
    });

    it("throws with an invalid/expired refresh token", async () => {
      vi.spyOn(jwt, "verify").mockImplementation(() => {
        throw new Error("Token expired");
      });

      await expect(authService.refreshToken("invalid_token")).rejects.toThrow();
    });
  });

  describe("logout", () => {
    it("adds the token to the Redis blacklist", async () => {
      const token = jwt.sign({ userId: "user-123" }, process.env.JWT_ACCESS_SECRET, {
        expiresIn: "15m",
      });

      vi.spyOn(jwt, "decode").mockReturnValue({ userId: "user-123", exp: Date.now() / 1000 + 900 });

      await authService.logout(token);

      expect(redis.setex).toHaveBeenCalled();
    });
  });

  describe("forgotPassword / resetPassword", () => {
    it("generates a reset token and does not reveal whether the email exists", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await authService.forgotPassword("nonexistent@example.com");

      expect(result).toEqual({ message: "If email exists, reset link was sent" });
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it("resets the password with a valid token", async () => {
      const mockUser = { id: "user-123", email: "test@example.com" };
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);
      vi.spyOn(bcrypt, "hash").mockResolvedValue("new_hashed_password");

      const result = await authService.resetPassword({
        token: "valid_token",
        newPassword: "newpass123",
      });

      expect(result.message).toContain("Password reset");
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it("throws with an expired or invalid token", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.resetPassword({ token: "invalid_token", newPassword: "newpass" })
      ).rejects.toThrow();
    });
  });
});