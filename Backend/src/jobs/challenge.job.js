import prisma from "../config/prisma.js";
import { assignChallenge } from "../services/challenge.service.js";
import { createNotification } from "../services/communication.service.js";
import { logger } from "../utils/logger.js";

// Users cannot request a social challenge themselves — the app assigns them
// automatically every so often as a popup, pairing people who are currently
// training at the gym at the same time. This job is what generates that
// popup: it looks for eligible pairs of checked-in users and, respecting all
// the same constraints as assignChallenge (no active session, no mid-exercise
// interruption, no duplicate active challenge, social disabled, etc.), creates
// a new SocialChallenge and notifies both participants so the app can surface
// it as a popup.
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

  // Shuffle so the same two users at the top of the list aren't always
  // matched first on every run.
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
      // Any pair that fails eligibility checks (disabled social, mid-exercise,
      // an existing active challenge, etc.) is skipped — it must not block
      // the rest of the pairs from being processed.
      logger.info(`[challenge.job] Skipped pairing ${userIdA}/${userIdB}: ${err.message}`);
    }
  }

  logger.info(`[challenge.job] Assigned ${assigned} new popup challenge(s).`);
  return { assigned };
}
