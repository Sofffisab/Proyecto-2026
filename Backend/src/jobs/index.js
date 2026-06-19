import { recalculatePoints } from "./points.job.js";
import { runAnalyticsJob } from "./analytics.job.js";
import { generateAnnualWrapped } from "./wrapped.job.js";
import { checkInactiveProgress } from "./progress.job.js";
import { processComplaints } from "./complaints.job.js";

const RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 2000;

/**
 * Ejecuta una función con reintentos ante fallos transitorios.
 * @param {string} name - Nombre del job para logging
 * @param {Function} fn - Función async a ejecutar
 */
async function withRetry(name, fn) {
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      await fn();
      console.log(`[jobs] ${name}: OK`);
      return;
    } catch (err) {
      console.error(`[jobs] ${name}: attempt ${attempt}/${RETRY_ATTEMPTS} FAILED — ${err.message}`);
      if (attempt < RETRY_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }
  console.error(`[jobs] ${name}: all attempts exhausted, skipping`);
}

/**
 * Entry point para cron system (Vercel / manual execution).
 * Cada job corre aislado con reintentos — un fallo no detiene los demás.
 */
export async function runJobs() {
  console.log("[jobs] Starting job run...");

  await withRetry("recalculatePoints", recalculatePoints);
  await withRetry("runAnalyticsJob", runAnalyticsJob);
  await withRetry("checkInactiveProgress", checkInactiveProgress);
  await withRetry("processComplaints", processComplaints);

  console.log("[jobs] Job run complete.");
}

export async function runWrappedJob(year = new Date().getFullYear()) {
  await withRetry(`generateAnnualWrapped(${year})`, () => generateAnnualWrapped(year));
}