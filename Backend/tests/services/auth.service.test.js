import { jest } from "@jest/globals";

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};
jest.unstable_mockModule("../../src/config/prisma.js", () => ({ default: mockPrisma }));
jest.unstable_mockModule("../../src/config/redis.js", () => ({ default: null }));
jest.unstable_mockModule("../../src/services/communication.service.js", () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

const authService = await import("../../src/services/auth.service.js");

describe("auth.service — register", () => {
  beforeEach(() => jest.clearAllMocks());

  it("throws if email already in use", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "1", email: "a@b.com" });
    await expect(authService.register({ email: "a@b.com", password: "pass1234", firstName: "A", lastName: "B" }))
      .rejects.toThrow("Email already in use");
  });

  it("creates user with role USER and returns sanitized user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "uuid-1", email: "a@b.com", firstName: "A", lastName: "B", role: "USER",
      passwordHash: "hash", passwordResetToken: null, passwordResetExpires: null,
    });
    const result = await authService.register({ email: "a@b.com", password: "pass1234", firstName: "A", lastName: "B" });
    expect(result.passwordHash).toBeUndefined();
    expect(result.role).toBe("USER");
  });
});

describe("auth.service — login", () => {
  it("throws on inactive user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isActive: false, passwordHash: "x" });
    await expect(authService.login({ email: "a@b.com", password: "pw" }))
      .rejects.toThrow("Invalid credentials");
  });
});
