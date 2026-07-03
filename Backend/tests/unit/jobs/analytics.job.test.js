import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAnalyticsJob } from "../../../jobs/analytics.job.js";
import { getGymAnalytics } from "../../../services/insights.service.js";
import { runPatternAnalysisForAll } from "../../../services/patternAnalysis.service.js";

vi.mock("../../../services/insights.service.js", () => ({
  getGymAnalytics: vi.fn(),
}));

vi.mock("../../../services/patternAnalysis.service.js", () => ({
  runPatternAnalysisForAll: vi.fn(),
}));

describe("runAnalyticsJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("llama a getGymAnalytics y runPatternAnalysisForAll", async () => {
    getGymAnalytics.mockResolvedValue({ totalCheckins: 42 });
    runPatternAnalysisForAll.mockResolvedValue();

    await runAnalyticsJob();

    expect(getGymAnalytics).toHaveBeenCalledTimes(1);
    expect(runPatternAnalysisForAll).toHaveBeenCalledTimes(1);
  });

  it("re-lanza el error si runPatternAnalysisForAll falla (para permitir retry)", async () => {
    getGymAnalytics.mockResolvedValue({ totalCheckins: 10 });
    runPatternAnalysisForAll.mockRejectedValue(new Error("Analysis Engine Failed"));

    await expect(runAnalyticsJob()).rejects.toThrow("Analysis Engine Failed");
  });
});