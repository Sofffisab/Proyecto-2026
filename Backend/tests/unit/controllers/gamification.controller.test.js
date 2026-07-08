import { describe, it, expect, beforeEach, vi } from "vitest";
import * as gamificationController from "../../../src/controllers/gamification.controller.js";
import * as gamificationService from "../../../src/services/gamification.service.js";
import * as wrappedService from "../../../src/services/wrapped.service.js";
import prisma from "../../../src/config/prisma.js";

vi.mock("../../../src/services/gamification.service.js");
vi.mock("../../../src/services/wrapped.service.js");

describe("GamificationController", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: { id: "user-1", role: "USER" },
      params: {},
      query: {},
      validatedData: {},
    };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it("getUserPoints returns the caller's points", async () => {
    gamificationService.getPoints.mockResolvedValue(150);

    await gamificationController.getUserPoints(req, res, next);

    expect(gamificationService.getPoints).toHaveBeenCalledWith("user-1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: 150 });
  });

  it("getUserBadges returns the caller's unlocked achievements", async () => {
    const badges = [{ id: "badge-1" }];
    gamificationService.getAchievements.mockResolvedValue(badges);

    await gamificationController.getUserBadges(req, res, next);

    expect(gamificationService.getAchievements).toHaveBeenCalledWith("user-1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: badges });
  });

  it("getWrapped defaults to the current year when none is given", async () => {
    const wrapped = { totalSessions: 5 };
    wrappedService.generateWrapped.mockResolvedValue(wrapped);
    const currentYear = new Date().getFullYear();

    await gamificationController.getWrapped(req, res, next);

    expect(wrappedService.generateWrapped).toHaveBeenCalledWith("user-1", currentYear);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: wrapped });
  });

  it("getWrapped uses the requested year when provided", async () => {
    req.query.year = "2025";
    wrappedService.generateWrapped.mockResolvedValue({});

    await gamificationController.getWrapped(req, res, next);

    expect(wrappedService.generateWrapped).toHaveBeenCalledWith("user-1", 2025);
  });

  it("createReviewRequest creates a pending review request for the caller", async () => {
    req.validatedData = { reason: "Points seem wrong" };
    const created = { id: "review-1", userId: "user-1", reason: "Points seem wrong", resolved: false };
    prisma.pointReviewRequest.create.mockResolvedValue(created);

    await gamificationController.createReviewRequest(req, res, next);

    expect(prisma.pointReviewRequest.create).toHaveBeenCalledWith({
      data: { userId: "user-1", reason: "Points seem wrong", resolved: false },
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: created });
  });

  it("getReviewRequests returns only unresolved requests", async () => {
    const requests = [{ id: "review-1", resolved: false }];
    prisma.pointReviewRequest.findMany.mockResolvedValue(requests);

    await gamificationController.getReviewRequests(req, res, next);

    expect(prisma.pointReviewRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { resolved: false } })
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, data: requests });
  });

  describe("resolveReviewRequest", () => {
    it("returns 404 via next() when the review request does not exist", async () => {
      req.params.id = "missing";
      prisma.pointReviewRequest.findUnique.mockResolvedValue(null);

      await gamificationController.resolveReviewRequest(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(404);
      expect(prisma.pointReviewRequest.update).not.toHaveBeenCalled();
    });

    it("marks the review request resolved by the acting admin", async () => {
      req.user = { id: "admin-1", role: "ADMIN" };
      req.params.id = "review-1";
      prisma.pointReviewRequest.findUnique.mockResolvedValue({ id: "review-1", resolved: false });
      const updated = { id: "review-1", resolved: true, reviewedBy: "admin-1" };
      prisma.pointReviewRequest.update.mockResolvedValue(updated);

      await gamificationController.resolveReviewRequest(req, res, next);

      expect(prisma.pointReviewRequest.update).toHaveBeenCalledWith({
        where: { id: "review-1" },
        data: { resolved: true, reviewedBy: "admin-1" },
      });
      expect(res.json).toHaveBeenCalledWith({ success: true, data: updated });
    });
  });

  it("forwards unexpected service errors to next()", async () => {
    const error = new Error("boom");
    gamificationService.getPoints.mockRejectedValue(error);

    await gamificationController.getUserPoints(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
