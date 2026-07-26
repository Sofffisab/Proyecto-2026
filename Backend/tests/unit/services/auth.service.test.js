import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import * as authService from "../../../src/services/auth.service.js";
import prisma from "../../../src/config/prisma.js";
import redis from "../../../src/config/redis.js";
import { sendPasswordResetEmail, sendEmail } from "../../../src/services/communication.service.js";
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

  describe("forgotPassword / resetPassword / verifyResetCode", () => {
    it("generates a reset code and does not reveal whether the email exists", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await authService.forgotPassword("nonexistent@example.com");

      expect(result).toEqual({ message: "If email exists, reset code was sent" });
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it("sends a reset email when the account exists (accepts a plain string or an { email } object)", async () => {
      const mockUser = { id: "user-123", email: "test@example.com" };
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);

      const result = await authService.forgotPassword({ email: "test@example.com" });

      expect(result).toEqual({ message: "If email exists, reset code was sent" });
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

    it("resets the password with a valid code", async () => {
      const mockUser = { id: "user-123", email: "test@example.com" };
      prisma.user.findFirst.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);
      vi.spyOn(bcrypt, "hash").mockResolvedValue("new_hashed_password");

      const result = await authService.resetPassword({
        token: "123456",
        newPassword: "newpass123",
      });

      expect(result.message).toContain("Password reset");
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it("throws with an expired or invalid code", async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        authService.resetPassword({ token: "000000", newPassword: "newpass123" })
      ).rejects.toThrow();
    });

    it("throws when the code matches a user but has already expired", async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: "user-123",
        email: "test@example.com",
        passwordResetExpires: new Date(Date.now() - 1000 * 60), // 1 minute in the past
      });

      await expect(
        authService.resetPassword({ token: "123456", newPassword: "newpass123" })
      ).rejects.toThrow("Invalid or expired reset code");
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("verifyResetCode resolves when the code matches and hasn't expired", async () => {
      const codeHash = crypto.createHash("sha256").update("123456").digest("hex");
      prisma.user.findUnique.mockResolvedValue({
        id: "user-123",
        email: "test@example.com",
        passwordResetToken: codeHash,
        passwordResetExpires: new Date(Date.now() + 1000 * 60 * 15),
      });

      const result = await authService.verifyResetCode({
        email: "test@example.com",
        code: "123456",
      });

      expect(result).toEqual({ valid: true });
    });

    it("verifyResetCode throws when the code doesn't match", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-123",
        email: "test@example.com",
        passwordResetToken: "some_other_hash",
        passwordResetExpires: new Date(Date.now() + 1000 * 60 * 15),
      });

      await expect(
        authService.verifyResetCode({ email: "test@example.com", code: "000000" })
      ).rejects.toThrow("Invalid or expired code");
    });

    it("verifyResetCode throws when the code has expired", async () => {
      const codeHash = crypto.createHash("sha256").update("123456").digest("hex");
      prisma.user.findUnique.mockResolvedValue({
        id: "user-123",
        email: "test@example.com",
        passwordResetToken: codeHash,
        passwordResetExpires: new Date(Date.now() - 1000 * 60),
      });

      await expect(
        authService.verifyResetCode({ email: "test@example.com", code: "123456" })
      ).rejects.toThrow("Invalid or expired code");
    });
  });
});