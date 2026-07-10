import { describe, it, expect, beforeEach, vi } from "vitest";
import * as analyticsController from "../../../src/controllers/analytics.controller.js";
import * as insightsService from "../../../src/services/insights.service.js";
import * as engagementService from "../../../src/services/engagement.service.js";
import * as behaviorAnalysisService from "../../../src/services/behaviorAnalysis.service.js";

vi.mock("../../../src/services/insights.service.js");
vi.mock("../../../src/services/engagement.service.js");
vi.mock("../../../src/services/behaviorAnalysis.service.js");

describe("AnalyticsController", () => {
  let req, res, next;

  beforeEach(() => {
    req = { user: { id: "user-1", role: "USER" }, params: {}, query: {}, body: {} };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it("getUserAnalytics returns 200 with the caller's analytics", async () => {
    const data = { totalSessions: 10 };
    insightsService.getUserAnalytics.mockResolvedValue(data);

    await analyticsController.getUserAnalytics(req, res, next);

    expect(insightsService.getUserAnalytics).toHaveBeenCalledWith("user-1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data });
  });

  it("getGymAnalytics returns 200 with gym-wide analytics", async () => {
    const data = { activeMembers: 42 };
    insightsService.getGymAnalytics.mockResolvedValue(data);

    await analyticsController.getGymAnalytics(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ success: true, data });
  });

  it("getUserPatterns returns the caller's behavior profile", async () => {
    const profile = { frequentDays: [], topMachines: [] };
    behaviorAnalysisService.getUserBehaviorProfile.mockResolvedValue(profile);

    await analyticsController.getUserPatterns(req, res, next);

    expect(behaviorAnalysisService.getUserBehaviorProfile).toHaveBeenCalledWith("user-1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: profile });
  });

  it("getEngagementMetrics returns 200 with engagement metrics", async () => {
    const metrics = { dau: 10, wau: 40 };
    engagementService.getEngagementMetrics.mockResolvedValue(metrics);

    await analyticsController.getEngagementMetrics(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ success: true, data: metrics });
  });

  it("forwards service errors to next() instead of throwing", async () => {
    const error = new Error("boom");
    insightsService.getUserAnalytics.mockRejectedValue(error);

    await analyticsController.getUserAnalytics(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.json).not.toHaveBeenCalled();
  });

  describe("getFullHistoryAdmin", () => {
    it("does not include identifiers by default (identified query param absent)", async () => {
      const data = [{ userHash: "abc123" }];
      insightsService.getFullHistoryAdmin.mockResolvedValue(data);

      await analyticsController.getFullHistoryAdmin(req, res, next);

      expect(insightsService.getFullHistoryAdmin).toHaveBeenCalledWith({
        includeIdentifiers: false,
      });
      expect(res.json).toHaveBeenCalledWith({ success: true, data });
    });

    it("includes identifiers when ?identified=true", async () => {
      req.query = { identified: "true" };
      const data = [{ userHash: "abc123", name: "Jane Doe", email: "jane@example.com" }];
      insightsService.getFullHistoryAdmin.mockResolvedValue(data);

      await analyticsController.getFullHistoryAdmin(req, res, next);

      expect(insightsService.getFullHistoryAdmin).toHaveBeenCalledWith({
        includeIdentifiers: true,
      });
      expect(res.json).toHaveBeenCalledWith({ success: true, data });
    });

    it("treats any value other than the literal string 'true' as false", async () => {
      req.query = { identified: "1" };
      insightsService.getFullHistoryAdmin.mockResolvedValue([]);

      await analyticsController.getFullHistoryAdmin(req, res, next);

      expect(insightsService.getFullHistoryAdmin).toHaveBeenCalledWith({
        includeIdentifiers: false,
      });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("DB error");
      insightsService.getFullHistoryAdmin.mockRejectedValue(error);

      await analyticsController.getFullHistoryAdmin(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
