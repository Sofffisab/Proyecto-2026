import prisma from "../config/prisma.js";
import { createNotification, sendEmail } from "./communication.service.js";

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
  return prisma.reward.update({
    where: { id },
    data: { name, description, pointsCost, active, stock, isMarketingItem },
  });
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

  if (eligibleRewards.length === 0) return null;

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

    return tx.rewardRedemption.create({
      data: { userId, rewardId: reward.id, status: "SHIPPED" },
    });
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
