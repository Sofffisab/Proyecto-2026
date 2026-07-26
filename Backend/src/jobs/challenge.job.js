import { prisma } from "../config/index.js";
import { assignChallenge } from "../services/challenge.service.js";
import { createNotification } from "../services/communication.service.js";
import { logger } from "../utils/logger.js";

// Auto-pairs checked-in users into social challenges (users can't request
// these themselves). Same eligibility constraints as assignChallenge.
const MAX_NEW_CHALLENGES_PER_RUN = 10;

export async function assignRandomChallenges() {
  const activeSessions = await prisma.gymSession.findMany({
    where: { checkOutAt: null },
    select: { userId: true },
    distinct: ["userId"],
  });

  const userIds = activeSessions.map((s) => s.userId);

  if (userIds.length < 2) {
    logger.info("[challenge.job] Not enough concurrently checked-in users to pair.");
    return { assigned: 0 };
  }

  // Shuffle so the same users aren't always matched first
  const shuffled = [...userIds].sort(() => Math.random() - 0.5);

  let assigned = 0;

  for (let i = 0; i < shuffled.length - 1 && assigned < MAX_NEW_CHALLENGES_PER_RUN; i += 2) {
    const userIdA = shuffled[i];
    const userIdB = shuffled[i + 1];

    try {
      const challenge = await assignChallenge(userIdA, userIdB);

      await Promise.all([
        createNotification(
          userIdA,
          "New challenge! 🔥",
          "You've been paired up for a social challenge — check it out!"
        ),
        createNotification(
          userIdB,
          "New challenge! 🔥",
          "You've been paired up for a social challenge — check it out!"
        ),
      ]);

      assigned++;
    } catch (err) {
      // Skip pairs that fail eligibility, without blocking the rest
      logger.info(`[challenge.job] Skipped pairing ${userIdA}/${userIdB}: ${err.message}`);
    }
  }

  logger.info(`[challenge.job] Assigned ${assigned} new popup challenge(s).`);
  return { assigned };
}
