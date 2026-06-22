import { getGymAnalytics } from "../services/insights.service.js";
import { runPatternAnalysisForAll } from "../services/patternAnalysis.service.js";

/**
 * Runs the daily analytics snapshot.
 * Imports from insights.service.js (the canonical implementation)
 * instead of analytics.service.js to avoid ambiguity.
 */
export async function runAnalyticsJob() {
  const data = await getGymAnalytics();
  console.log("[analyticsJob] Gym analytics snapshot:", data);

  await runPatternAnalysisForAll();
  console.log("[analyticsJob] Pattern analysis complete.");
}