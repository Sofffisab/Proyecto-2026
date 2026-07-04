import prisma from "../config/prisma.js";
import { createNotification, sendEmail } from "./communication.service.js";

export async function getAvailableRewards() {
  return prisma.reward.findMany({
    where: { active: true },
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
  const { name, description, pointsCost, active } = data;
  return prisma.reward.create({
    data: { name, description, pointsCost: pointsCost ?? 0, active: active ?? true },
  });
}

export async function updateReward(id, data) {
  const reward = await prisma.reward.findUnique({ where: { id } });
  if (!reward) throw new Error("Reward not found");

  const { name, description, pointsCost, active } = data;
  return prisma.reward.update({
    where: { id },
    data: { name, description, pointsCost, active },
  });
}

// Rewards are NOT chosen by the user. The gym decides what prize ships based
// on the point thresholds it configures (via createReward/updateReward), and
// the prize is sent automatically — with an email — the moment the user's
// point balance crosses a threshold they haven't already been granted.
// This replaces the old "catalog, pick one, redeem" flow on purpose.
export async function autoGrantRewards(userId) {
  const agg = await prisma.pointTransaction.aggregate({
    where: { userId },
    _sum: { points: true },
  });
  const totalPoints = agg._sum.points ?? 0;

  const alreadyGranted = await prisma.rewardRedemption.findMany({
    where: { userId },
    select: { rewardId: true },
  });
  const grantedIds = new Set(alreadyGranted.map((r) => r.rewardId));

  const eligible = await prisma.reward.findMany({
    where: { active: true, pointsCost: { lte: totalPoints } },
    orderBy: { pointsCost: "asc" },
  });

  const granted = [];
  for (const reward of eligible) {
    if (grantedIds.has(reward.id)) continue;

    const redemption = await prisma.$transaction(async (tx) => {
      const existing = await tx.rewardRedemption.findFirst({
        where: { userId, rewardId: reward.id },
      });
      if (existing) return null;

      await tx.pointTransaction.create({
        data: {
          userId,
          points: -reward.pointsCost,
          reason: `Reward earned: ${reward.name}`,
        },
      });

      return tx.rewardRedemption.create({
        data: { userId, rewardId: reward.id, status: "PENDING" },
      });
    });

    if (redemption) {
      granted.push(redemption);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true },
      });
      if (user) {
        createNotification(
          userId,
          "You earned a reward! 🎁",
          `You reached ${reward.pointsCost} points and earned "${reward.name}". The gym will send it to you.`
        ).catch(() => {});
        sendEmail(
          user.email,
          `You earned a reward: ${reward.name}`,
          `<h2>Congratulations, ${user.firstName}!</h2>
           <p>You reached ${reward.pointsCost} points and earned <strong>${reward.name}</strong>.</p>
           <p>The gym will prepare it and it'll reach you soon — no action needed on your end.</p>`
        ).catch(() => {});
      }
    }
  }

  return granted;
}

export async function approveReward(redemptionId, adminId) {
  const redemption = await prisma.rewardRedemption.findUnique({ where: { id: redemptionId } });
  if (!redemption) throw new Error("Redemption not found");
  if (redemption.status !== "PENDING") {
    throw new Error(`Cannot approve a redemption with status: ${redemption.status}`);
  }

  return prisma.rewardRedemption.update({
    where: { id: redemptionId },
    data: { status: "APPROVED", approvedBy: adminId, approvedAt: new Date() },
  });
}

export async function rejectReward(redemptionId, adminId) {
  const redemption = await prisma.rewardRedemption.findUnique({
    where: { id: redemptionId },
    include: { reward: true },
  });
  if (!redemption) throw new Error("Redemption not found");
  if (redemption.status !== "PENDING") {
    throw new Error(`Cannot reject a redemption with status: ${redemption.status}`);
  }

  // Rejecting a redemption must refund the points that were deducted
  // up front in generateReward, otherwise the user permanently loses
  // points for a reward they never received.
  return prisma.$transaction(async (tx) => {
    await tx.pointTransaction.create({
      data: {
        userId: redemption.userId,
        points: redemption.reward.pointsCost,
        reason: `Redemption rejected — points refunded: ${redemption.reward.name}`,
      },
    });

    return tx.rewardRedemption.update({
      where: { id: redemptionId },
      // reviewedBy tracks who took the action (approve OR reject).
      // approvedBy is intentionally left null on rejections to keep semantics clear.
      data: { status: "REJECTED", reviewedBy: adminId, reviewedAt: new Date() },
    });
  });
}

export async function shipReward(redemptionId) {
  const redemption = await prisma.rewardRedemption.findUnique({ where: { id: redemptionId } });
  if (!redemption) throw new Error("Redemption not found");
  if (redemption.status !== "APPROVED") {
    throw new Error(`Cannot ship a redemption with status: ${redemption.status}`);
  }

  return prisma.rewardRedemption.update({
    where: { id: redemptionId },
    data: { status: "SHIPPED", shippedAt: new Date() },
  });
}

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