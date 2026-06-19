import { getGymAnalytics } from "../services/analytics.service.js";
import { runPatternAnalysisForAll } from "../services/patternAnalysis.service.js";

export async function runAnalyticsJob() {
  const data = await getGymAnalytics();
  console.log("[analyticsJob] Gym analytics snapshot:", data);

  await runPatternAnalysisForAll();
  console.log("[analyticsJob] Pattern analysis complete.");

  // futuro: guardar snapshot en tabla analytics_snapshot
}