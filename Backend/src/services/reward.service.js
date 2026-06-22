import prisma from "../config/prisma.js";
import { addPoints } from "./gamification.service.js";

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

  const transactions = await prisma.pointTransaction.findMany({
    where: { userId },
    select: { points: true },
  });
  const totalPoints = transactions.reduce((acc, t) => acc + t.points, 0);

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
  return prisma.rewardRedemption.update({
    where: { id: redemptionId },
    data: { status: "APPROVED", approvedBy: adminId, approvedAt: new Date() },
  });
}

export async function rejectReward(redemptionId, adminId) {
  return prisma.rewardRedemption.update({
    where: { id: redemptionId },
    data: { status: "REJECTED", approvedBy: adminId, approvedAt: new Date() },
  });
}

export async function shipReward(redemptionId) {
  return prisma.rewardRedemption.update({
    where: { id: redemptionId },
    data: { status: "SHIPPED", shippedAt: new Date() },
  });
}

export async function deliverReward(redemptionId) {
  return prisma.rewardRedemption.update({
    where: { id: redemptionId },
    data: { status: "DELIVERED", deliveredAt: new Date() },
  });
}