import { getGymAnalytics } from "../services/insights.service.js";
import { runPatternAnalysisForAll } from "../services/behaviorAnalysis.service.js";
import { logger } from "../utils/logger.js";

/** Runs the daily analytics snapshot; surfaces total failures instead of swallowing them silently. */
export async function runAnalyticsJob() {
  const data = await getGymAnalytics();
  logger.info("[analyticsJob] Gym analytics snapshot:", data);

  try {
    await runPatternAnalysisForAll();
    logger.info("[analyticsJob] Pattern analysis complete.");
  } catch (err) {
    // Failed before it could iterate users (e.g. DB unreachable)
    logger.error("[analyticsJob] Pattern analysis FAILED — results were NOT persisted:", err.message);
    throw err; // re-throw so the job runner's withRetry can attempt again
  }
}