import prisma from "../config/prisma.js";
import { POINTS } from "../constants/points.js";
import { addPoints, checkAndUnlockAchievements } from "./gamification.service.js";
import { AppError } from "../utils/errors.js";

// Social challenges expire after this long if nobody responds/completes them.
const CHALLENGE_TTL_HOURS = parseInt(process.env.SOCIAL_CHALLENGE_TTL_HOURS ?? "24", 10);

// Shared eligibility guard used both by the scheduled auto-matching job
// (assignChallenge) and the instant QR-pairing endpoint (pairFromScan) —
// the two ways a SocialChallenge can come into existence.
async function assertChallengeEligibility(userIdA, userIdB) {
  if (userIdA === userIdB) {
    throw new AppError("A user cannot challenge themselves", 400);
  }

  const [settingsA, settingsB] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId: userIdA } }),
    prisma.userSettings.findUnique({ where: { userId: userIdB } }),
  ]);

  if (settingsA?.disableSocial || settingsB?.disableSocial) {
    throw new AppError("One or both users have social challenges disabled", 400);
  }

  // Social challenges are station/machine-based (they're assigned at a
  // machine and completed by scanning there). Users who opted out of
  // machine tracking are excluded from this matching entirely — they keep
  // interacting with trainers, just not with other members at a machine.
  if (settingsA?.machineTrackingOptOut || settingsB?.machineTrackingOptOut) {
    throw new AppError("One or both users have machine tracking disabled and cannot be matched for a station challenge", 400);
  }

  const [sessionA, sessionB] = await Promise.all([
    prisma.gymSession.findFirst({ where: { userId: userIdA, checkOutAt: null } }),
    prisma.gymSession.findFirst({ where: { userId: userIdB, checkOutAt: null } }),
  ]);

  if (!sessionA) throw new AppError("The first user does not have an active gym session", 400);
  if (!sessionB) throw new AppError("The second user does not have an active gym session", 400);

  // A user mid-exercise (actively using a machine, not yet ended) should not
  // be interrupted with a new social challenge assignment.
  const [usageA, usageB] = await Promise.all([
    prisma.machineUsage.findFirst({ where: { userId: userIdA, endedAt: null } }),
    prisma.machineUsage.findFirst({ where: { userId: userIdB, endedAt: null } }),
  ]);

  if (usageA) throw new AppError("The first user is mid-exercise and cannot be assigned a challenge right now", 400);
  if (usageB) throw new AppError("The second user is mid-exercise and cannot be assigned a challenge right now", 400);
}

function findActiveChallengeBetween(userIdA, userIdB) {
  return prisma.socialChallenge.findFirst({
    where: {
      OR: [
        { userId: userIdA, partnerUserId: userIdB },
        { userId: userIdB, partnerUserId: userIdA },
      ],
      status: { in: ["ASSIGNED", "ACCEPTED"] },
    },
  });
}

export async function assignChallenge(userIdA, userIdB, station) {
  await assertChallengeEligibility(userIdA, userIdB);

  const existing = await findActiveChallengeBetween(userIdA, userIdB);

  if (existing) {
    throw new AppError("An active challenge already exists between these users", 409);
  }

  return prisma.socialChallenge.create({
    data: {
      userId: userIdA,
      partnerUserId: userIdB,
      station,
      status: "ASSIGNED",
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_HOURS * 60 * 60 * 1000),
    },
  });
}

// Instant pairing via physical QR exchange: one member's screen shows their
// personal QR (GET /qr/me), the other scans it with their camera and this
// is called with the scanned userId. There is no search form — the two
// phones being next to each other, screen-to-camera, at the same moment
// *is* the mutual consent, so (unlike assignChallenge, which waits for a
// separate accept step) the challenge starts life already ACCEPTED.
export async function pairFromScan(scannerId, targetUserId, station) {
  await assertChallengeEligibility(scannerId, targetUserId);

  const existing = await findActiveChallengeBetween(scannerId, targetUserId);

  if (existing) {
    if (existing.status === "ACCEPTED") {
      // Duplicate scan (e.g. camera fired twice) — idempotent, just return it.
      return existing;
    }
    // An ASSIGNED challenge already exists between these two (e.g. from the
    // scheduled auto-matching job). Scanning each other in person is a
    // stronger signal than that async assignment — upgrade it instead of
    // erroring out.
    return prisma.socialChallenge.update({
      where: { id: existing.id },
      data: { status: "ACCEPTED" },
    });
  }

  return prisma.socialChallenge.create({
    data: {
      userId: scannerId,
      partnerUserId: targetUserId,
      station: station ?? null,
      status: "ACCEPTED",
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_HOURS * 60 * 60 * 1000),
    },
  });
}

export async function acceptChallenge(challengeId, userId) {
  const challenge = await prisma.socialChallenge.findUnique({ where: { id: challengeId } });
  if (!challenge) throw new AppError("Challenge not found", 404);
  if (challenge.partnerUserId !== userId) throw new AppError("Forbidden: Only the challenged partner can accept", 403);
  if (challenge.status !== "ASSIGNED") throw new AppError("Challenge cannot be accepted in its current state", 400);

  return prisma.socialChallenge.update({
    where: { id: challengeId },
    data: { status: "ACCEPTED" },
  });
}

export async function rejectChallenge(challengeId, callerId) {
  const challenge = await prisma.socialChallenge.findUnique({ where: { id: challengeId } });
  if (!challenge) throw new AppError("Challenge not found", 404);

  if (challenge.userId !== callerId && challenge.partnerUserId !== callerId) {
    throw new AppError("Forbidden", 403);
  }

  const allowed = ["ASSIGNED", "ACCEPTED"];
  if (!allowed.includes(challenge.status)) {
    throw new AppError("Challenge cannot be cancelled in its current state", 400);
  }

  const previousStatus = challenge.status;

  const updated = await prisma.socialChallenge.update({
    where: { id: challengeId },
    data: { status: "REJECTED" },
  });

  if (previousStatus === "ACCEPTED" && callerId !== challenge.partnerUserId) {
    // Only the assigner (userId) backing out after the partner already
    // accepted counts as the partner having "made the effort" — award them
    // consolation points. If the partner is the one rejecting their own
    // acceptance, they didn't follow through, so no points are awarded.
    await addPoints(
      challenge.partnerUserId,
      POINTS.SOCIAL_CHALLENGE_ATTEMPTED,
      "Social challenge attempted"
    );
  }

  return updated;
}

export async function completeChallengeByQR(challengeId, callerId, partnerId) {
  const challenge = await prisma.socialChallenge.findUnique({ where: { id: challengeId } });
  if (!challenge) throw new AppError("Challenge not found", 404);

  const isUserA = challenge.userId === callerId && challenge.partnerUserId === partnerId;
  const isUserB = challenge.partnerUserId === callerId && challenge.userId === partnerId;
  if (!isUserA && !isUserB) {
    throw new AppError("Provided partnerId does not match this challenge match-up", 400);
  }

  if (challenge.status !== "ACCEPTED") {
    throw new AppError("Challenge must be ACCEPTED by the partner before it can be completed", 400);
  }

  const updated = await prisma.socialChallenge.update({
    where: { id: challengeId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  await Promise.all([
    addPoints(challenge.userId, POINTS.SOCIAL_CHALLENGE_COMPLETED, "Social challenge completed"),
    addPoints(challenge.partnerUserId, POINTS.SOCIAL_CHALLENGE_COMPLETED, "Social challenge completed"),
    // Record the social interaction in both directions so wrapped.service.js's
    // peopleMetCount (filtered by type: "CHALLENGE_COMPLETED") can find it.
    prisma.socialInteraction.create({
      data: {
        userId: challenge.userId,
        targetUserId: challenge.partnerUserId,
        type: "CHALLENGE_COMPLETED",
      },
    }),
    prisma.socialInteraction.create({
      data: {
        userId: challenge.partnerUserId,
        targetUserId: challenge.userId,
        type: "CHALLENGE_COMPLETED",
      },
    }),
  ]);

  // A completed challenge can push either participant's social-interaction
  // count past a badge threshold — best-effort, never blocks the response.
  Promise.all([
    checkAndUnlockAchievements(challenge.userId),
    checkAndUnlockAchievements(challenge.partnerUserId),
  ]).catch(() => {});

  return updated;
}

export async function getActiveChallenges(userId) {
  return prisma.socialChallenge.findMany({
    where: {
      OR: [{ userId }, { partnerUserId: userId }],
      status: { in: ["ASSIGNED", "ACCEPTED"] },
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      partner: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getChallengeHistory(userId) {
  return prisma.socialChallenge.findMany({
    where: { OR: [{ userId }, { partnerUserId: userId }] },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      partner: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getActiveSocialChallenges(userId) {
  return getActiveChallenges(userId);
}

export async function getChallengeById(challengeId, userId) {
  const challenge = await prisma.socialChallenge.findUnique({
    where: { id: challengeId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      partner: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!challenge) return null;

  if (challenge.userId !== userId && challenge.partnerUserId !== userId) {
    throw new AppError("Forbidden", 403);
  }

  return challenge;
}

// Alias kept for controllers that reference the "social" naming — same data
// as getChallengeHistory (every SocialChallenge involves two participants).
export async function getSocialHistory(userId) {
  return getChallengeHistory(userId);
}