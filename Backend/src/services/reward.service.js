import prisma from "../config/prisma.js";

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

export async function generateReward(userId, rewardId) {
  const reward = await prisma.reward.findUnique({ where: { id: rewardId } });
  if (!reward) throw new Error("Reward not found");
  if (!reward.active) throw new Error("Reward is not available");

  const agg = await prisma.pointTransaction.aggregate({
    where: { userId },
    _sum: { points: true },
  });
  const totalPoints = agg._sum.points ?? 0;

  if (totalPoints < reward.pointsCost) {
    throw new Error(
      `Not enough points. Required: ${reward.pointsCost}, available: ${totalPoints}`
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.pointTransaction.create({
      data: {
        userId,
        points: -reward.pointsCost,
        reason: `Reward redeemed: ${reward.name}`,
      },
    });

    return tx.rewardRedemption.create({
      data: { userId, rewardId, status: "PENDING" },
    });
  });
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
  const redemption = await prisma.rewardRedemption.findUnique({ where: { id: redemptionId } });
  if (!redemption) throw new Error("Redemption not found");
  if (redemption.status !== "PENDING") {
    throw new Error(`Cannot reject a redemption with status: ${redemption.status}`);
  }

  return prisma.rewardRedemption.update({
    where: { id: redemptionId },
    // reviewedBy tracks who took the action (approve OR reject).
    // approvedBy is intentionally left null on rejections to keep semantics clear.
    data: { status: "REJECTED", reviewedBy: adminId, reviewedAt: new Date() },
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
// Fix #14: fetch all redemptions (admin view)
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
