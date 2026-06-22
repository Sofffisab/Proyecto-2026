// src/jobs/progress.job.js
import { runSuggestionEngineForAll } from "../services/suggestionEngine.service.js";

/**
 * Triggers the suggestion engine for all active users.
 *
 * Note: the previous loop that checked for inactive progress entries was
 * removed because it collected results but never acted on them (no notification,
 * no alert, no input to the suggestion engine). The suggestion engine already
 * processes all active users independently via runSuggestionEngineForAll().
 * If per-user inactivity notifications are needed in the future, implement them
 * inside the suggestion engine service where the logic can be properly used.
 */
export async function checkInactiveProgress() {
  await runSuggestionEngineForAll();
  console.log("[progressJob] Suggestion engine run complete.");
}