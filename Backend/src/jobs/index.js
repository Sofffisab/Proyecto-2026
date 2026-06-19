import { recalculatePoints } from "./points.job.js";
import { runAnalyticsJob } from "./analytics.job.js";
import { generateAnnualWrapped } from "./wrapped.job.js";
import { checkInactiveProgress } from "./progress.job.js";
import { processComplaints } from "./complaints.job.js";

export async function runJobs() {
  console.log("[jobs] Starting job run...");

  try {
    await recalculatePoints();
    console.log("[jobs] recalculatePoints: OK");
  } catch (err) {
    console.error("[jobs] recalculatePoints: FAILED", err.message);
  }

  try {
    await runAnalyticsJob();
    console.log("[jobs] runAnalyticsJob: OK");
  } catch (err) {
    console.error("[jobs] runAnalyticsJob: FAILED", err.message);
  }

  try {
    await checkInactiveProgress();
    console.log("[jobs] checkInactiveProgress: OK");
  } catch (err) {
    console.error("[jobs] checkInactiveProgress: FAILED", err.message);
  }

  try {
    await processComplaints();
    console.log("[jobs] processComplaints: OK");
  } catch (err) {
    console.error("[jobs] processComplaints: FAILED", err.message);
  }

  console.log("[jobs] Job run complete.");
}

export async function runWrappedJob(year = new Date().getFullYear()) {
  try {
    await generateAnnualWrapped(year);
    console.log(`[jobs] generateAnnualWrapped(${year}): OK`);
  } catch (err) {
    console.error(`[jobs] generateAnnualWrapped(${year}): FAILED`, err.message);
  }
}