import { getGymAnalytics } from "../services/analytics.service.js";

/**
 * Job de métricas globales del gym
 */
export async function runAnalyticsJob() {
  const data = await getGymAnalytics();

  console.log("Gym analytics snapshot:", data);

  // futuro: guardar en tabla analytics_snapshot
}