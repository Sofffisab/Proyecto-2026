import prisma from "../config/prisma.js";
import { createNotification, sendEmail } from "./communication.service.js";
import { logger } from "../utils/logger.js";
import { POINTS_HARD_CAP } from "../constants/points.js";

// Public/user-facing: never expose stock or isMarketingItem. Users don't
// pick a reward and shouldn't be able to infer availability/marketing
// classification — they just receive whatever is randomly granted when
// they hit the threshold (see autoGrantRewards).
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

// Admin-only: full reward catalog including stock and marketing classification.
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

  // Restocking (or newly activating) a reward can unblock users who were
  // sitting in the pending-shipment queue — try to fulfill it now. This is
  // best-effort/non-blocking so an admin edit is never slowed down by it.
  if (typeof stock === "number" && stock > reward.stock) {
    fulfillPendingGrants().catch((err) =>
      logger.error("[reward] Failed to fulfill pending grants after restock:", err.message)
    );
  }

  return updated;
}

// Rewards are NOT chosen by the user, and there is no "pending redemption"
// workflow to approve. When the user's cumulative point balance reaches the
// configured threshold, a reward ships automatically and immediately, and
// the user's points reset back to 0 — the redemption record IS the shipment,
// created already as SHIPPED.
//
// Which reward: randomly among the active rewards that (a) are currently in
// stock and (b) the user's points qualify for (pointsCost <= totalPoints).
// Users never see stock ahead of time — it's purely an admin/fulfillment
// concern — so surprise/randomness among "whatever's available" is the
// intended behavior, not a fallback. Stock is decremented atomically inside
// the same transaction that resets points, so two users hitting the
// threshold at once can't both be granted the last unit.
//
// If the user qualifies by points but nothing is currently in stock, they
// are queued in RewardPendingGrant instead of just being silently skipped —
// see getPendingGrants (admin-facing "people waiting for shipment" list)
// and fulfillPendingGrants (retried automatically once stock frees up).
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
    // Only queue if the user actually qualifies for *some* active reward by
    // points — just having stockless rewards below their threshold doesn't
    // count as "waiting on stock".
    const qualifiesByPoints = await prisma.reward.findFirst({
      where: { active: true, pointsCost: { lte: totalPoints } },
    });
    if (qualifiesByPoints) {
      await queuePendingGrant(userId, totalPoints);
    }

    // Safety net: points must NEVER reach 5 digits (10000+), regardless of
    // reward catalog/stock misconfiguration. If nothing was grantable above
    // and the balance is already at/over the hard cap, force-clamp it back
    // down and flag an admin review — this should basically never fire under
    // normal operation (rewards reset points to 0 well before this), it only
    // guards against an admin leaving the catalog empty/out of stock for too
    // long.
    if (totalPoints >= POINTS_HARD_CAP) {
      await enforcePointsCeiling(userId, totalPoints);
    }
    return null;
  }

  const reward = eligibleRewards[Math.floor(Math.random() * eligibleRewards.length)];

  const redemption = await prisma.$transaction(async (tx) => {
    // Atomically claim one unit of stock. If another concurrent grant beat
    // us to the last unit, this updates 0 rows and we bail out below.
    const stockClaim = await tx.reward.updateMany({
      where: { id: reward.id, stock: { gt: 0 } },
      data: { stock: { decrement: 1 } },
    });

    if (stockClaim.count === 0) {
      return null;
    }

    // Reset the user's points back to 0. This is the automatic redemption —
    // there is nothing further for the user or an admin to approve.
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

    // If this user had an open pending-grant entry (queued from an earlier
    // attempt that found no stock), close it out and link it to the
    // redemption that finally fulfilled it.
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

// Absolute safety net so a user's balance can never reach 5 digits (10000+),
// no matter how the reward catalog is configured. Under normal operation
// this never fires — autoGrantRewards resets points to 0 well before
// POINTS_HARD_CAP whenever the catalog has a reachable, in-stock reward.
// If it ever does fire, it means an admin left the catalog without any
// affordable/in-stock reward for a long stretch — clamp the balance back
// down (via a corrective PointTransaction, keeping full history intact) and
// raise a PointReviewRequest so an admin fixes the catalog.
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

// Adds the user to the pending-shipment queue, unless they're already in it
// (one open entry per user — repeated addPoints calls while still waiting
// on stock shouldn't pile up duplicate rows). The points snapshot is
// refreshed to the latest value so the admin queue shows current standing.
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

// Admin-facing: users currently waiting for a reward to be restocked,
// oldest first. Each entry shows the points balance at the moment they
// qualified (a live re-check happens automatically via fulfillPendingGrants
// whenever stock is added — see updateReward above).
export async function getPendingGrants() {
  return prisma.rewardPendingGrant.findMany({
    where: { fulfilledAt: null },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

// Retries autoGrantRewards for everyone still waiting in the queue, oldest
// first, so restocking a reward drains the backlog in first-come order
// rather than leaving it to the next time each user happens to earn a
// point. Each attempt re-reads the user's live point balance (via
// autoGrantRewards), so someone who kept earning points while queued is
// evaluated fairly, not against a stale snapshot.
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

// Admin-facing: mark a shipped reward as physically received by the user.
// There is no approve/reject step — the grant itself already happened
// automatically in autoGrantRewards.
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
