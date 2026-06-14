import { recalculatePoints } from "./points.job.js";
import { runAnalyticsJob } from "./analytics.job.js";
import { generateAnnualWrapped } from "./wrapped.job.js";
import { checkInactiveProgress } from "./progress.job.js";
import { processComplaints } from "./complaints.job.js";

/**
 * Entry point para cron system (Vercel / manual execution)
 */
export async function runJobs() {
  console.log("Running jobs...");

  await recalculatePoints();
  await runAnalyticsJob();
  await checkInactiveProgress();
  await processComplaints();

  console.log("Jobs completed");
}

export async function runWrappedJob(year = new Date().getFullYear()) {
  await generateAnnualWrapped(year);
}