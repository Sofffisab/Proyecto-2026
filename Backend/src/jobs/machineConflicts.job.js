import { expireUnverifiedConflicts } from "../services/machineConflict.service.js";
import { logger } from "../utils/logger.js";

/**
 * Runs machineConflict.service.js#expireUnverifiedConflicts — any "2
 * personas en la misma máquina" conflict a trainer never verified in time
 * gets auto-marked UNVERIFIED and a mutual complaint is raised.
 */
export async function processMachineConflicts() {
  const { expired } = await expireUnverifiedConflicts();
  logger.info(`[machineConflicts.job] Expired ${expired} unverified machine conflict(s).`);
}
