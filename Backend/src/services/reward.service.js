import prisma from "../config/prisma.js";
import { getPoints } from "./gamification.service.js";

export async function generateReward(userId, rewardId) {
  const reward = await prisma.reward.findUnique({ where: { id: rewardId } });

  if (!reward) throw new Error("Reward not found");
  if (!reward.active) throw new Error("Reward is not active");

  const { totalPoints } = await getPoints(userId);
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
      data: {
        userId,
        rewardId,
        status: "PENDING",
      },
    });
  });
}

export async function approveReward(id, adminId) {
  return prisma.rewardRedemption.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedBy: adminId,
      approvedAt: new Date(),
    },
  });
}

export async function shipReward(id) {
  return prisma.rewardRedemption.update({
    where: { id },
    data: {
      status: "SHIPPED",
      shippedAt: new Date(),
    },
  });
}

export async function deliverReward(id) {
  return prisma.rewardRedemption.update({
    where: { id },
    data: {
      status: "DELIVERED",
      deliveredAt: new Date(),
    },
  });
}