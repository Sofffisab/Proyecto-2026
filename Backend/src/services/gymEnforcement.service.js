import prisma from "../config/prisma.js";
import { AppError } from "../utils/errors.js";

// Blocks machine usage while the user has an active ACCEPTED_BY_BOTH social challenge.
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