import { recalculatePoints } from './points.job.js';
import { runAnalyticsJob } from './analytics.job.js';
import { generateAnnualWrapped } from './wrapped.job.js';
import { checkInactiveProgress } from './progress.job.js';
import { processComplaints } from './complaints.job.js';

const RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 2000;

/**
 * Runs a function with retries on transient failures.
 * @param {string} name - Job name for logging
 * @param {Function} fn - Async function to execute
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
 * Entry point for the cron system (Vercel / manual execution).
 * Each job runs in isolation with retries — one failure does not stop the others.
 */
export async function runJobs() {
  console.log('[jobs] Starting job run...');

  await withRetry('recalculatePoints', recalculatePoints);
  await withRetry('runAnalyticsJob', runAnalyticsJob);
  await withRetry('checkInactiveProgress', checkInactiveProgress);
  await withRetry('processComplaints', processComplaints);

  console.log('[jobs] Job run complete.');
}

export async function runWrappedJob(year = new Date().getFullYear()) {
  await withRetry(`generateAnnualWrapped(${year})`, () => generateAnnualWrapped(year));
}