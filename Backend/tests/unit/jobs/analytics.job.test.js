import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAnalyticsJob } from "../../../src/jobs/analytics.job.js";
import { getGymAnalytics } from "../../../src/services/insights.service.js";
import { runPatternAnalysisForAll } from "../../../src/services/patternAnalysis.service.js";

vi.mock("../../../src/services/insights.service.js", () => ({
  getGymAnalytics: vi.fn(),
}));

vi.mock("../../../src/services/patternAnalysis.service.js", () => ({
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

  it("re-throws the error if runPatternAnalysisForAll fails (to allow retry)", async () => {
    getGymAnalytics.mockResolvedValue({ totalCheckins: 10 });
    runPatternAnalysisForAll.mockRejectedValue(new Error("Analysis Engine Failed"));

    await expect(runAnalyticsJob()).rejects.toThrow("Analysis Engine Failed");
  });
});