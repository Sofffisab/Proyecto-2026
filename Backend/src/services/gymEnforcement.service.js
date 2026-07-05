import prisma from "../config/prisma.js";
import { AppError } from "../utils/errors.js";

/**
 * Enforces machine access restrictions based on active social challenges.
 * User cannot use machines if they have an active ACCEPTED_BY_BOTH social challenge.
 * Call this before allowing machine usage.
 */
export async function enforceNoActiveChallengeForMachineUsage(userId) {
  const activeChallenge = await prisma.socialChallenge.findFirst({
    where: {
      OR: [{ userId }, { partnerUserId: userId }],
      status: "ACCEPTED_BY_BOTH",
    },
    include: {
      user: { select: { firstName: true, lastName: true } },
      partner: { select: { firstName: true, lastName: true } },
    },
  });

  if (activeChallenge) {
    const partnerName =
      activeChallenge.userId === userId
        ? `${activeChallenge.partner.firstName} ${activeChallenge.partner.lastName}`
        : `${activeChallenge.user.firstName} ${activeChallenge.user.lastName}`;

    throw new AppError(
      `You cannot use other machines right now. You have an active social challenge with ${partnerName} that must be completed, cancelled, or expired first.`,
      409
    );
  }
}