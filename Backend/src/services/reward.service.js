import prisma from "../config/prisma.js";

export async function generateReward(userId, rewardId) {
  return prisma.rewardRedemption.create({
    data: {
      userId,
      rewardId,
      status: "PENDING",
    },
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