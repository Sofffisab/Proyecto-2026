import prisma from "../config/prisma.js";
import { createNotification, sendEmail } from "./communication.service.js";
import { logger } from "../utils/logger.js";
import { POINTS_HARD_CAP } from "../constants/points.js";

// User-facing fields only: never expose stock or isMarketingItem
const PUBLIC_REWARD_FIELDS = {
  id: true,
  name: true,
  description: true,
  pointsCost: true,
  active: true,
  createdAt: true,
};

export async function getAvailableRewards() {
  return prisma.reward.findMany({
    where: { active: true },
    orderBy: { pointsCost: "asc" },
    select: PUBLIC_REWARD_FIELDS,
  });
}

// Admin-only: full catalog including stock and marketing classification
export async function getAllRewardsAdmin() {
  return prisma.reward.findMany({
    orderBy: { pointsCost: "asc" },
  });
}

export async function getUserRedemptions(userId) {
  return prisma.rewardRedemption.findMany({
    where: { userId },
    include: { reward: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getRewardById(id) {
  return prisma.reward.findUnique({ where: { id } });
}

export async function createReward(data) {
  const { name, description, pointsCost, active, stock, isMarketingItem } = data;
  return prisma.reward.create({
    data: {
      name,
      description,
      pointsCost: pointsCost ?? 0,
      active: active ?? true,
      stock: stock ?? 0,
      isMarketingItem: isMarketingItem ?? false,
    },
  });
}

export async function updateReward(id, data) {
  const reward = await prisma.reward.findUnique({ where: { id } });
  if (!reward) throw new Error("Reward not found");

  const { name, description, pointsCost, active, stock, isMarketingItem } = data;
  const updated = await prisma.reward.update({
    where: { id },
    data: { name, description, pointsCost, active, stock, isMarketingItem },
  });

  // Restocking may unblock users waiting in the pending-shipment queue (non-blocking)
  if (typeof stock === "number" && stock > reward.stock) {
    fulfillPendingGrants().catch((err) =>
      logger.error("[reward] Failed to fulfill pending grants after restock:", err.message)
    );
  }

  return updated;
}

// Auto-ships a random active/in-stock/affordable reward once points cross
// the threshold, resetting points to 0. Queues in RewardPendingGrant if out of stock.
export async function autoGrantRewards(userId) {
  const agg = await prisma.pointTransaction.aggregate({
    where: { userId },
    _sum: { points: true },
  });
  const totalPoints = agg._sum.points ?? 0;

  if (totalPoints <= 0) return null;

  const eligibleRewards = await prisma.reward.findMany({
    where: { active: true, stock: { gt: 0 }, pointsCost: { lte: totalPoints } },
  });

  if (eligibleRewards.length === 0) {
    // Only queue if the user qualifies for some active reward by points
    const qualifiesByPoints = await prisma.reward.findFirst({
      where: { active: true, pointsCost: { lte: totalPoints } },
    });
    if (qualifiesByPoints) {
      await queuePendingGrant(userId, totalPoints);
    }

    // Safety net: points must never reach 5 digits regardless of catalog state
    if (totalPoints >= POINTS_HARD_CAP) {
      await enforcePointsCeiling(userId, totalPoints);
    }
    return null;
  }

  const reward = eligibleRewards[Math.floor(Math.random() * eligibleRewards.length)];

  const redemption = await prisma.$transaction(async (tx) => {
    // Atomically claim one unit of stock; 0 rows updated means we lost the race
    const stockClaim = await tx.reward.updateMany({
      where: { id: reward.id, stock: { gt: 0 } },
      data: { stock: { decrement: 1 } },
    });

    if (stockClaim.count === 0) {
      return null;
    }

    // Reset points to 0 — this IS the redemption, nothing further to approve
    await tx.pointTransaction.create({
      data: {
        userId,
        points: -totalPoints,
        reason: `Reward earned & points reset: ${reward.name}`,
      },
    });

    const created = await tx.rewardRedemption.create({
      data: { userId, rewardId: reward.id, status: "SHIPPED" },
    });

    // Close out any open pending-grant entry, linked to this redemption
    if (tx.rewardPendingGrant) {
      const openPending = await tx.rewardPendingGrant.findFirst({
        where: { userId, fulfilledAt: null },
        orderBy: { createdAt: "asc" },
      });
      if (openPending) {
        await tx.rewardPendingGrant.update({
          where: { id: openPending.id },
          data: { fulfilledAt: new Date(), fulfilledRedemptionId: created.id },
        });
      }
    }

    return created;
  });

  if (!redemption) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, firstName: true },
  });

  if (user) {
    createNotification(
      userId,
      "You earned a reward! 🎁",
      `You reached ${reward.pointsCost} points and earned "${reward.name}". The gym is shipping it to you — your point balance has reset to 0.`
    ).catch(() => {});
    sendEmail(
      user.email,
      `You earned a reward: ${reward.name}`,
      `<h2>Congratulations, ${user.firstName}!</h2>
       <p>You reached ${reward.pointsCost} points and earned <strong>${reward.name}</strong>.</p>
       <p>It's already on its way — no action needed on your end. Your point balance has reset to 0 so you can start earning your next reward.</p>`
    ).catch(() => {});
  }

  return redemption;
}

// Safety net: clamps balance below POINTS_HARD_CAP and raises an admin
// review request if the catalog has no reachable/in-stock reward
async function enforcePointsCeiling(userId, totalPoints) {
  if (totalPoints < POINTS_HARD_CAP) return;

  const overflow = totalPoints - (POINTS_HARD_CAP - 1);

  await prisma.pointTransaction.create({
    data: {
      userId,
      points: -overflow,
      reason: `Points ceiling safety cap applied (catalog had no reachable/in-stock reward)`,
    },
  });

  try {
    await prisma.pointReviewRequest.create({
      data: {
        userId,
        reason:
          `POINTS_CEILING_HIT: user's balance reached the ${POINTS_HARD_CAP} hard cap with no ` +
          `affordable/in-stock reward available. Review the Reward catalog (pointsCost/stock).`,
        resolved: false,
      },
    });
  } catch (err) {
    logger.error("[reward] Failed to raise points-ceiling review request:", err.message);
  }
}

// Adds user to the pending-shipment queue (one open entry per user;
// refreshes the points snapshot if already queued)
async function queuePendingGrant(userId, totalPoints) {
  const existing = await prisma.rewardPendingGrant.findFirst({
    where: { userId, fulfilledAt: null },
  });

  if (existing) {
    if (existing.pointsAtQueueTime !== totalPoints) {
      await prisma.rewardPendingGrant.update({
        where: { id: existing.id },
        data: { pointsAtQueueTime: totalPoints },
      });
    }
    return existing;
  }

  return prisma.rewardPendingGrant.create({
    data: { userId, pointsAtQueueTime: totalPoints },
  });
}

// Admin-facing: users waiting for restock, oldest first
export async function getPendingGrants() {
  return prisma.rewardPendingGrant.findMany({
    where: { fulfilledAt: null },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

// Retries autoGrantRewards for the whole queue, oldest first, using each
// user's live point balance (drains backlog after a restock)
export async function fulfillPendingGrants() {
  const pending = await prisma.rewardPendingGrant.findMany({
    where: { fulfilledAt: null },
    orderBy: { createdAt: "asc" },
  });

  let fulfilled = 0;
  for (const entry of pending) {
    const redemption = await autoGrantRewards(entry.userId);
    if (redemption) fulfilled++;
  }

  return { checked: pending.length, fulfilled };
}

// Admin-facing: marks a shipped reward as physically received
export async function deliverReward(redemptionId) {
  const redemption = await prisma.rewardRedemption.findUnique({ where: { id: redemptionId } });
  if (!redemption) throw new Error("Redemption not found");
  if (redemption.status !== "SHIPPED") {
    throw new Error(`Cannot deliver a redemption with status: ${redemption.status}`);
  }

  return prisma.rewardRedemption.update({
    where: { id: redemptionId },
    data: { status: "DELIVERED", deliveredAt: new Date() },
  });
}

export async function getAllRedemptions() {
  return prisma.rewardRedemption.findMany({
    include: {
      reward: true,
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
