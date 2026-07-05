import { getGymAnalytics } from "../services/insights.service.js";
import { runPatternAnalysisForAll } from "../services/behaviorAnalysis.service.js";

/**
 * Runs the daily analytics snapshot.
 * Imports from insights.service.js (the canonical implementation)
 * instead of analytics.service.js to avoid ambiguity.
 *
 * Bug 29: runPatternAnalysisForAll already isolates per-user errors so one
 * failure doesn't abort the loop, but silent notification failures meant
 * analysis results were discarded invisibly. The job now logs the outcome
 * explicitly and wraps the call in a try/catch so a total failure is surfaced
 * rather than swallowed.
 */
export async function runAnalyticsJob() {
  const data = await getGymAnalytics();
  console.log("[analyticsJob] Gym analytics snapshot:", data);

  try {
    await runPatternAnalysisForAll();
    console.log("[analyticsJob] Pattern analysis complete.");
  } catch (err) {
    // A top-level error here means the analysis failed before it could iterate
    // users (e.g. DB unreachable). Log it explicitly so ops can investigate.
    console.error("[analyticsJob] Pattern analysis FAILED — results were NOT persisted:", err.message);
    throw err; // re-throw so the job runner's withRetry can attempt again
  }
}