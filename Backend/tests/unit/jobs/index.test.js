import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The global setup.js mocks jobs/index.js as an HTTP-handler stub (for route
// tests). This suite needs the real cron implementation, so unmock it here.
vi.unmock("../../../src/jobs/index.js");

import { runJobs, runWrappedJob } from "../../../src/jobs/index.js";
import { recalculatePoints } from "../../../src/jobs/points.job.js";
import { runAnalyticsJob } from "../../../src/jobs/analytics.job.js";
import { checkInactiveProgress } from "../../../src/jobs/progress.job.js";
import { processComplaints } from "../../../src/jobs/complaints.job.js";
import { generateAnnualWrapped } from "../../../src/jobs/wrapped.job.js";
import { expireStaleEntities } from "../../../src/jobs/expiration.job.js";
import { assignRandomChallenges } from "../../../src/jobs/challenge.job.js";
import { processMachineConflicts } from "../../../src/jobs/machineConflicts.job.js";

vi.mock("../../../src/jobs/points.job.js", () => ({ recalculatePoints: vi.fn() }));
vi.mock("../../../src/jobs/analytics.job.js", () => ({ runAnalyticsJob: vi.fn() }));
vi.mock("../../../src/jobs/progress.job.js", () => ({ checkInactiveProgress: vi.fn() }));
vi.mock("../../../src/jobs/complaints.job.js", () => ({ processComplaints: vi.fn() }));
vi.mock("../../../src/jobs/wrapped.job.js", () => ({ generateAnnualWrapped: vi.fn() }));
vi.mock("../../../src/jobs/expiration.job.js", () => ({ expireStaleEntities: vi.fn() }));
vi.mock("../../../src/jobs/challenge.job.js", () => ({ assignRandomChallenges: vi.fn() }));
vi.mock("../../../src/jobs/machineConflicts.job.js", () => ({ processMachineConflicts: vi.fn() }));

describe("runJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks() resets call history but NOT a mock's configured
    // implementation/resolution — so a test that does
    // `processMachineConflicts.mockRejectedValue(...)` would otherwise leak
    // that rejection into every test that runs after it. Reset every mock
    // back to a resolved no-op explicitly before each test.
    recalculatePoints.mockResolvedValue();
    runAnalyticsJob.mockResolvedValue();
    checkInactiveProgress.mockResolvedValue();
    processComplaints.mockResolvedValue();
    generateAnnualWrapped.mockResolvedValue();
    expireStaleEntities.mockResolvedValue();
    assignRandomChallenges.mockResolvedValue();
    processMachineConflicts.mockResolvedValue();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    // Use fake timers so the system date can be freely manipulated
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("always runs the 4 base jobs (with withRetry)", async () => {
    // Set a common date (June 15) to avoid triggering the wrapped job
    vi.setSystemTime(new Date(2026, 5, 15));

    await runJobs();

    expect(recalculatePoints).toHaveBeenCalledTimes(1);
    expect(runAnalyticsJob).toHaveBeenCalledTimes(1);
    expect(checkInactiveProgress).toHaveBeenCalledTimes(1);
    expect(processComplaints).toHaveBeenCalledTimes(1);
    expect(processMachineConflicts).toHaveBeenCalledTimes(1);
    expect(expireStaleEntities).toHaveBeenCalledTimes(1);
    expect(assignRandomChallenges).toHaveBeenCalledTimes(1);
    expect(generateAnnualWrapped).not.toHaveBeenCalled();
  });

  it("retries processMachineConflicts on failure just like the other jobs", async () => {
    vi.setSystemTime(new Date(2026, 5, 15));

    processMachineConflicts.mockRejectedValue(new Error("Conflict expiry failed"));

    await runJobs();

    expect(processMachineConflicts).toHaveBeenCalledTimes(2); // RETRY_ATTEMPTS = 2
    // A failure here must not block the jobs that run after it.
    expect(expireStaleEntities).toHaveBeenCalledTimes(1);
    expect(assignRandomChallenges).toHaveBeenCalledTimes(1);
  });

  it("retries up to RETRY_ATTEMPTS before giving up", async () => {
    vi.setSystemTime(new Date(2026, 5, 15));

    // Force a specific job to consistently fail
    recalculatePoints.mockRejectedValue(new Error("Transient Error"));

    await runJobs();

    // RETRY_ATTEMPTS = 2 en index.js
    expect(recalculatePoints).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("[ERROR]"),
      expect.stringContaining("[jobs] recalculatePoints: all attempts exhausted, skipping")
    );
  });

  it("a failing job does not prevent the others from running", async () => {
    vi.setSystemTime(new Date(2026, 5, 15));

    recalculatePoints.mockRejectedValue(new Error("Fatal error"));
    runAnalyticsJob.mockResolvedValue();

    await runJobs();

    expect(recalculatePoints).toHaveBeenCalledTimes(2);
    expect(runAnalyticsJob).toHaveBeenCalledTimes(1); // The next one still runs the same way
  });

  it("does NOT run generateAnnualWrapped if the date is not January 1st", async () => {
    vi.setSystemTime(new Date(2026, 11, 31)); // 31 de Diciembre

    await runJobs();

    expect(generateAnnualWrapped).not.toHaveBeenCalled();
  });

  it("DOES run generateAnnualWrapped(year-1) if the date is January 1st", async () => {
    vi.setSystemTime(new Date(2027, 0, 1)); // 1 de Enero de 2027

    await runJobs();

    expect(generateAnnualWrapped).toHaveBeenCalledTimes(1);
    expect(generateAnnualWrapped).toHaveBeenCalledWith(2026); // Must pass the previous year (2026)
  });
});

describe("runWrappedJob (manual/CLI trigger export)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateAnnualWrapped.mockResolvedValue();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("generates the wrapped report for the given year", async () => {
    await runWrappedJob(2024);

    expect(generateAnnualWrapped).toHaveBeenCalledWith(2024);
  });

  it("defaults to the current year when no year is passed", async () => {
    vi.setSystemTime(new Date(2026, 6, 11)); // July 11, 2026

    await runWrappedJob();

    expect(generateAnnualWrapped).toHaveBeenCalledWith(2026);
  });

  it("retries like the other jobs and gives up after RETRY_ATTEMPTS on persistent failure", async () => {
    generateAnnualWrapped.mockRejectedValue(new Error("DB unavailable"));

    await runWrappedJob(2024);

    expect(generateAnnualWrapped).toHaveBeenCalledTimes(2); // RETRY_ATTEMPTS = 2
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("[ERROR]"),
      expect.stringContaining("generateAnnualWrapped(2024): all attempts exhausted, skipping")
    );
  });
});