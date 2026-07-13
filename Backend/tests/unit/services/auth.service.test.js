import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import * as authService from "../../../src/services/auth.service.js";
import prisma from "../../../src/config/prisma.js";
import redis from "../../../src/config/redis.js";
import { sendPasswordResetEmail, sendWelcomeEmail, sendEmail } from "../../../src/services/communication.service.js";
import { AppError } from "../../../src/utils/errors.js";

// Local mock so Redis calls are tracked in this test file
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

    it("does not throw when the welcome email fails to send (fire-and-forget)", async () => {
      const mockUser = { id: "user-123", email: "test@example.com", firstName: "John", role: "USER" };
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);
      vi.spyOn(bcrypt, "hash").mockResolvedValue("hashed");
      sendWelcomeEmail.mockRejectedValue(new Error("SMTP down"));

      const result = await authService.register({
        email: "test@example.com",
        password: "pass",
        firstName: "John",
        lastName: "Doe",
      });

      expect(result.accessToken).toBeDefined();
      // Let the fire-and-forget rejection settle before the test ends
      await new Promise((r) => setImmediate(r));
    });
  });

  describe("createUserByAdmin", () => {
    it("creates a user with a random unusable password and a set-password token, and emails them", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: "user-999",
        email: "new@example.com",
        firstName: "Ann",
        lastName: "Lee",
        role: "TRAINER",
      });
      vi.spyOn(bcrypt, "hash").mockResolvedValue("random_hash");

      const result = await authService.createUserByAdmin({
        email: "new@example.com",
        firstName: "Ann",
        lastName: "Lee",
        role: "TRAINER",
      });

      expect(result.email).toBe("new@example.com");
      expect(result.passwordHash).toBeUndefined();
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: "TRAINER",
            passwordResetToken: expect.any(String),
            passwordResetExpires: expect.any(Date),
          }),
        })
      );
      expect(sendEmail).toHaveBeenCalled();
    });

    it("defaults role to USER when not provided", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: "user-1", email: "a@b.com", firstName: "A" });
      vi.spyOn(bcrypt, "hash").mockResolvedValue("hash");

      await authService.createUserByAdmin({ email: "a@b.com", firstName: "A", lastName: "B" });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: "USER" }) })
      );
    });

    it("throws if the email already exists", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "existing" });

      await expect(
        authService.createUserByAdmin({ email: "a@b.com", firstName: "A", lastName: "B" })
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

    it("throws when the token is valid but the user no longer exists", async () => {
      vi.spyOn(jwt, "verify").mockReturnValue({ userId: "ghost-user" });
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.refreshToken("some_token")).rejects.toThrow("User unavailable");
    });

    it("throws when the token is valid but the user was deactivated", async () => {
      vi.spyOn(jwt, "verify").mockReturnValue({ userId: "user-123" });
      prisma.user.findUnique.mockResolvedValue({ id: "user-123", isActive: false });

      await expect(authService.refreshToken("some_token")).rejects.toThrow("User unavailable");
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

    it("falls back to the default TTL when the decoded token has no exp claim", async () => {
      vi.spyOn(jwt, "decode").mockReturnValue({ userId: "user-123" }); // no exp

      await authService.logout("some_token");

      expect(redis.setex).toHaveBeenCalledWith(
        expect.stringContaining("blacklist:"),
        15 * 60,
        "1"
      );
    });

    it("does nothing when there is no token", async () => {
      const result = await authService.logout(undefined);

      expect(redis.setex).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });

  describe("me", () => {
    it("returns the sanitized user when found", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-123",
        email: "a@b.com",
        passwordHash: "secret",
      });

      const result = await authService.me("user-123");

      expect(result.email).toBe("a@b.com");
      expect(result.passwordHash).toBeUndefined();
    });

    it("throws 404 when the user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.me("ghost")).rejects.toThrow("User not found");
    });
  });

  describe("forgotPassword / resetPassword", () => {
    it("generates a reset token and does not reveal whether the email exists", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await authService.forgotPassword("nonexistent@example.com");

      expect(result).toEqual({ message: "If email exists, reset link was sent" });
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it("sends a reset email when the account exists (accepts a plain string or an { email } object)", async () => {
      const mockUser = { id: "user-123", email: "test@example.com" };
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);

      const result = await authService.forgotPassword({ email: "test@example.com" });

      expect(result).toEqual({ message: "If email exists, reset link was sent" });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-123" },
          data: expect.objectContaining({
            passwordResetToken: expect.any(String),
            passwordResetExpires: expect.any(Date),
          }),
        })
      );
      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        "test@example.com",
        expect.any(String),
        "user-123"
      );
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

    it("throws when the token matches a user but has already expired", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-123",
        email: "test@example.com",
        passwordResetExpires: new Date(Date.now() - 1000 * 60), // 1 minute in the past
      });

      await expect(
        authService.resetPassword({ token: "expired_token", newPassword: "newpass123" })
      ).rejects.toThrow("Invalid or expired reset token");
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});