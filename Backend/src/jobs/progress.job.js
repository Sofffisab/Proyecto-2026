import { runSuggestionEngineForAll } from "../services/suggestionEngine.service.js";
import { logger } from "../utils/logger.js";

/**
 * Triggers the suggestion engine for all active users.
 * (The previous per-user inactive-progress check was removed — it collected
 * results but never acted on them; runSuggestionEngineForAll covers this.)
 */
export async function checkInactiveProgress() {
  await runSuggestionEngineForAll();
  logger.info("[progressJob] Suggestion engine run complete.");
}