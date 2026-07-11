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

  it("strips the /api/v1 prefix from originalUrl before matching exempt paths (production mount)", async () => {
    // In production the router is also mounted under /api/v1 (see
    // server.js), so req.originalUrl arrives as e.g. "/api/v1/users/me"
    // instead of the bare "/users/me" the other tests use.
    req.originalUrl = "/api/v1/users/me?foo=bar";
    req.path = "/me"; // Express would have already stripped the use() mount prefix
    await requireCompleteProfile(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("does NOT exempt a /api/v1-prefixed path that isn't actually in the exempt list", async () => {
    req.originalUrl = "/api/v1/goals";
    req.path = "/goals";
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      birthday: new Date("1990-01-01"),
      medicalConditions: [],
      deliveryAddress: "Main St 123",
      trainingLevel: "BEGINNER",
      objectives: ["LOSE_WEIGHT"],
      weeklyTrainingDays: "THREE",
      trainingType: "STRENGTH",
      isProfileComplete: true,
    });
    await requireCompleteProfile(req, res, next);
    expect(prisma.user.findUnique).toHaveBeenCalled();
  });

  it("blocks the request with 403 when the profile is incomplete", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      birthday: null,
      medicalConditions: null,
      deliveryAddress: null,
      trainingLevel: null,
      objectives: [],
      weeklyTrainingDays: null,
      trainingType: null,
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
      trainingLevel: "BEGINNER",
      objectives: ["LOSE_WEIGHT"],
      weeklyTrainingDays: "THREE",
      trainingType: "STRENGTH",
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
      trainingLevel: "BEGINNER",
      objectives: ["LOSE_WEIGHT"],
      weeklyTrainingDays: "THREE",
      trainingType: "STRENGTH",
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
  const fullPantallaU = {
    trainingLevel: "BEGINNER",
    objectives: ["LOSE_WEIGHT"],
    weeklyTrainingDays: "THREE",
    trainingType: "STRENGTH",
  };

  it("returns false when any pre-existing required field is missing", () => {
    expect(
      isProfileDataComplete({ birthday: null, medicalConditions: [], deliveryAddress: "x", ...fullPantallaU })
    ).toBe(false);
    expect(
      isProfileDataComplete({ birthday: new Date(), medicalConditions: null, deliveryAddress: "x", ...fullPantallaU })
    ).toBe(false);
    expect(
      isProfileDataComplete({ birthday: new Date(), medicalConditions: [], deliveryAddress: "", ...fullPantallaU })
    ).toBe(false);
  });

  it("returns false when any pantalla U field (perfil mínimo) is missing", () => {
    const base = { birthday: new Date(), medicalConditions: [], deliveryAddress: "Main St 123" };
    expect(isProfileDataComplete({ ...base, ...fullPantallaU, trainingLevel: null })).toBe(false);
    expect(isProfileDataComplete({ ...base, ...fullPantallaU, objectives: [] })).toBe(false);
    expect(isProfileDataComplete({ ...base, ...fullPantallaU, objectives: null })).toBe(false);
    expect(isProfileDataComplete({ ...base, ...fullPantallaU, weeklyTrainingDays: null })).toBe(false);
    expect(isProfileDataComplete({ ...base, ...fullPantallaU, trainingType: null })).toBe(false);
  });

  it("returns true when all required fields, including the 4 pantalla U fields, are present", () => {
    expect(
      isProfileDataComplete({
        birthday: new Date(),
        medicalConditions: [],
        deliveryAddress: "Main St 123",
        ...fullPantallaU,
      })
    ).toBe(true);
  });
});
