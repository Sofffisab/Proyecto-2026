import { prisma } from "../prisma/prisma.js";
import { ERROR_CODES, STATUS, paginate } from "../shared/utils.js";
import { sendPushAndNotification } from "./notifications.js";

// ============ LEADERBOARD ============

export const getLeaderboard = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  try {
    const pagination = paginate(parseInt(page), parseInt(limit));

    const [users, total] = await Promise.all([
      prisma.userPoints.findMany({
        orderBy: { totalPoints: "desc" },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              username: true,
              photoUrl: true,
            },
          },
        },
        ...pagination,
      }),
      prisma.userPoints.count(),
    ]);

    const leaderboard = users.map((up, index) => ({
      rank: pagination.skip + index + 1,
      user: up.user,
      totalPoints: up.totalPoints,
      currentPoints: up.currentPoints,
    }));

    return res.status(200).json({
      leaderboard,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[GAMIFICATION] Get leaderboard error:", error);
    return res.status(500).json({
      error: "Failed to get leaderboard",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ REWARDS ============

export const getRewards = async (req, res) => {
  try {
    const rewards = await prisma.reward.findMany({
      where: { available: true },
      orderBy: { pointsCost: "asc" },
    });

    return res.status(200).json({ rewards });
  } catch (error) {
    console.error("[GAMIFICATION] Get rewards error:", error);
    return res.status(500).json({
      error: "Failed to get rewards",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const claimReward = async (req, res) => {
  const { rewardId } = req.params;

  try {
    const [reward, userPoints] = await Promise.all([
      prisma.reward.findUnique({ where: { id: rewardId } }),
      prisma.userPoints.findUnique({ where: { userId: req.user.id } }),
    ]);

    if (!reward) {
      return res.status(404).json({
        error: "Reward not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    if (!reward.available) {
      return res.status(400).json({
        error: "Reward is not available",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    if (reward.quantity !== null && reward.quantity <= 0) {
      return res.status(400).json({
        error: "Reward is out of stock",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    if (!userPoints || userPoints.currentPoints < reward.pointsCost) {
      return res.status(400).json({
        error: "Insufficient points",
        code: ERROR_CODES.INSUFFICIENT_POINTS,
      });
    }

    const [claim, _, updatedReward] = await prisma.$transaction([
      prisma.rewardClaim.create({
        data: {
          rewardId,
          userId: req.user.id,
          status: STATUS.PENDING,
        },
      }),
      prisma.userPoints.update({
        where: { userId: req.user.id },
        data: {
          currentPoints: { decrement: reward.pointsCost },
        },
      }),
      reward.quantity !== null
        ? prisma.reward.update({
            where: { id: rewardId },
            data: {
              quantity: { decrement: 1 },
              available: reward.quantity - 1 > 0,
            },
          })
        : prisma.reward.findUnique({ where: { id: rewardId } }),
    ]);

    await sendPushAndNotification(
      req.user.id,
      "reward_claimed",
      "Reward Claimed",
      `You claimed ${reward.name}. Pending approval.`,
      { claimId: claim.id, rewardId }
    );

    return res.status(201).json({
      message: "Reward claimed successfully",
      claim,
      pointsDeducted: reward.pointsCost,
    });
  } catch (error) {
    console.error("[GAMIFICATION] Claim reward error:", error);
    return res.status(500).json({
      error: "Failed to claim reward",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ USER POINTS ============

export const getUserPoints = async (req, res) => {
  try {
    const userPoints = await prisma.userPoints.findUnique({
      where: { userId: req.user.id },
    });

    const rank = await prisma.userPoints.count({
      where: {
        totalPoints: { gt: userPoints?.totalPoints || 0 },
      },
    });

    return res.status(200).json({
      points: userPoints || { totalPoints: 0, currentPoints: 0 },
      rank: rank + 1,
    });
  } catch (error) {
    console.error("[GAMIFICATION] Get user points error:", error);
    return res.status(500).json({
      error: "Failed to get points",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const getPointsHistory = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  try {
    const pagination = paginate(parseInt(page), parseInt(limit));

    const [claims, total] = await Promise.all([
      prisma.rewardClaim.findMany({
        where: { userId: req.user.id },
        include: {
          reward: {
            select: {
              id: true,
              name: true,
              pointsCost: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        ...pagination,
      }),
      prisma.rewardClaim.count({ where: { userId: req.user.id } }),
    ]);

    return res.status(200).json({
      history: claims,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[GAMIFICATION] Get points history error:", error);
    return res.status(500).json({
      error: "Failed to get points history",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};