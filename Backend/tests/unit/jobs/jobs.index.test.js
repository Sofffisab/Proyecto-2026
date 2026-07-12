import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// jobs/index.js is globally mocked in tests/setup.js for every OTHER test
// file (so hitting a real cron endpoint in an e2e test doesn't run the
// entire job suite). Here we specifically want the REAL module, so we
// unmock it for this file only.
vi.unmock("../../../src/jobs/index.js");

vi.mock("../../../src/jobs/points.job.js", () => ({ recalculatePoints: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../../src/jobs/analytics.job.js", () => ({ runAnalyticsJob: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../../src/jobs/wrapped.job.js", () => ({ generateAnnualWrapped: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../../src/jobs/progress.job.js", () => ({ checkInactiveProgress: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../../src/jobs/complaints.job.js", () => ({ processComplaints: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../../src/jobs/expiration.job.js", () => ({ expireStaleEntities: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../../src/jobs/challenge.job.js", () => ({ assignRandomChallenges: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../../src/jobs/machineConflicts.job.js", () => ({ processMachineConflicts: vi.fn().mockResolvedValue(undefined) }));

import { runJobs, runWrappedJob } from "../../../src/jobs/index.js";
import { generateAnnualWrapped } from "../../../src/jobs/wrapped.job.js";

describe("jobs/index.js — runJobs orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does NOT run the annual wrapped job on a regular day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T12:00:00Z"));

    await runJobs();

    expect(generateAnnualWrapped).not.toHaveBeenCalled();
  });

  it("does NOT run the annual wrapped job on Dec 31 (day before)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-31T12:00:00Z"));

    await runJobs();

    expect(generateAnnualWrapped).not.toHaveBeenCalled();
  });

  it("runs the annual wrapped job for the PREVIOUS year exactly on January 1st", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:05:00Z"));

    await runJobs();

    expect(generateAnnualWrapped).toHaveBeenCalledTimes(1);
    expect(generateAnnualWrapped).toHaveBeenCalledWith(2025);
  });

  it("does NOT run the annual wrapped job on January 2nd", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-02T00:05:00Z"));

    await runJobs();

    expect(generateAnnualWrapped).not.toHaveBeenCalled();
  });
});

describe("jobs/index.js — runWrappedJob (manual/CLI trigger)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates the wrapped report for the given year", async () => {
    await runWrappedJob(2024);

    expect(generateAnnualWrapped).toHaveBeenCalledWith(2024);
  });

  it("defaults to the current year when no year is passed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T12:00:00Z"));

    await runWrappedJob();

    expect(generateAnnualWrapped).toHaveBeenCalledWith(2026);

    vi.useRealTimers();
  });
});
