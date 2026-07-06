import { describe, it, expect, beforeEach, vi } from "vitest";
import { requireCompleteProfile, isProfileDataComplete } from "../../../src/middlewares/profileCompletion.middleware.js";
import prisma from "../../../src/config/prisma.js";

describe("requireCompleteProfile middleware", () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = { user: { id: "user-1", role: "USER" }, path: "/goals" };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
  });

  it("calls next() when there is no authenticated user yet", async () => {
    req.user = undefined;
    await requireCompleteProfile(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("skips the check entirely for non-USER roles (TRAINER/ADMIN)", async () => {
    req.user = { id: "trainer-1", role: "TRAINER" };
    await requireCompleteProfile(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("skips the check for exempt paths (e.g. /users/me) so the profile can be completed", async () => {
    req.path = "/users/me";
    await requireCompleteProfile(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("blocks the request with 403 when the profile is incomplete", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      birthday: null,
      medicalConditions: null,
      deliveryAddress: null,
      isProfileComplete: false,
    });

    await requireCompleteProfile(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, code: "PROFILE_INCOMPLETE" })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("lets the request through when the profile is complete", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      birthday: new Date("1990-01-01"),
      medicalConditions: [],
      deliveryAddress: "Main St 123",
      isProfileComplete: true,
    });

    await requireCompleteProfile(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("lazily persists isProfileComplete when it becomes true but was stale", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      birthday: new Date("1990-01-01"),
      medicalConditions: [],
      deliveryAddress: "Main St 123",
      isProfileComplete: false,
    });
    prisma.user.update.mockResolvedValue({});

    await requireCompleteProfile(req, res, next);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { isProfileComplete: true },
    });
    expect(next).toHaveBeenCalledWith();
  });

  it("forwards unexpected errors to next()", async () => {
    const error = new Error("db down");
    prisma.user.findUnique.mockRejectedValue(error);

    await requireCompleteProfile(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("isProfileDataComplete", () => {
  it("returns false when any required field is missing", () => {
    expect(isProfileDataComplete({ birthday: null, medicalConditions: [], deliveryAddress: "x" })).toBe(false);
    expect(isProfileDataComplete({ birthday: new Date(), medicalConditions: null, deliveryAddress: "x" })).toBe(false);
    expect(isProfileDataComplete({ birthday: new Date(), medicalConditions: [], deliveryAddress: "" })).toBe(false);
  });

  it("returns true when all required fields are present", () => {
    expect(
      isProfileDataComplete({ birthday: new Date(), medicalConditions: [], deliveryAddress: "Main St 123" })
    ).toBe(true);
  });
});
