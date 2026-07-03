import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkInactiveProgress } from "../../../src/jobs/progress.job.js";
import { runSuggestionEngineForAll } from "../../../src/services/suggestionEngine.service.js";

vi.mock("../../../src/services/suggestionEngine.service.js", () => ({
  runSuggestionEngineForAll: vi.fn(),
}));

describe("checkInactiveProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delega en runSuggestionEngineForAll y loguea al terminar", async () => {
    runSuggestionEngineForAll.mockResolvedValue();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await checkInactiveProgress();

    expect(runSuggestionEngineForAll).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith("[progressJob] Suggestion engine run complete.");
    
    consoleSpy.mockRestore();
  });
});