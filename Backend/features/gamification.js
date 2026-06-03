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

// ============ POINTS (ALIAS) ============

export const getPoints = getUserPoints;

// ============ MANUAL POINTS ============

export const addPointsManual = async (req, res) => {
  const { userId } = req.params;
  const { points, reason } = req.body;

  if (!points || typeof points !== "number" || points <= 0) {
    return res.status(400).json({
      error: "Valid points amount is required",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const userPoints = await prisma.userPoints.update({
      where: { userId },
      data: {
        totalPoints: { increment: points },
        currentPoints: { increment: points },
      },
    });

    await sendPushAndNotification(
      userId,
      "points_earned",
      "Points Added",
      `You received ${points} points. ${reason || ""}`,
      { points }
    );

    return res.status(200).json({
      message: "Points added",
      pointsAdded: points,
      userPoints,
    });
  } catch (error) {
    console.error("[GAMIFICATION] Add points manual error:", error);
    return res.status(500).json({
      error: "Failed to add points",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const deductPointsManual = async (req, res) => {
  const { userId } = req.params;
  const { points, reason } = req.body;

  if (!points || typeof points !== "number" || points <= 0) {
    return res.status(400).json({
      error: "Valid points amount is required",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const currentPoints = await prisma.userPoints.findUnique({
      where: { userId },
    });

    if (!currentPoints || currentPoints.currentPoints < points) {
      return res.status(400).json({
        error: "Insufficient points",
        code: ERROR_CODES.INSUFFICIENT_POINTS,
      });
    }

    const userPoints = await prisma.userPoints.update({
      where: { userId },
      data: {
        currentPoints: { decrement: points },
      },
    });

    await sendPushAndNotification(
      userId,
      "points_deducted",
      "Points Deducted",
      `${points} points were deducted. ${reason || ""}`,
      { points }
    );

    return res.status(200).json({
      message: "Points deducted",
      pointsDeducted: points,
      userPoints,
    });
  } catch (error) {
    console.error("[GAMIFICATION] Deduct points manual error:", error);
    return res.status(500).json({
      error: "Failed to deduct points",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ REWARD MANAGEMENT ============

export const createReward = async (req, res) => {
  const { name, description, pointsCost, quantity } = req.body;

  if (!name || pointsCost === undefined) {
    return res.status(400).json({
      error: "Name and points cost are required",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const reward = await prisma.reward.create({
      data: {
        name,
        description,
        pointsCost,
        quantity,
      },
    });

    return res.status(201).json({
      message: "Reward created",
      reward,
    });
  } catch (error) {
    console.error("[GAMIFICATION] Create reward error:", error);
    return res.status(500).json({
      error: "Failed to create reward",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const updateReward = async (req, res) => {
  const { rewardId } = req.params;
  const { name, description, pointsCost, quantity, available } = req.body;

  try {
    const reward = await prisma.reward.findUnique({
      where: { id: rewardId },
    });

    if (!reward) {
      return res.status(404).json({
        error: "Reward not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (pointsCost !== undefined) updateData.pointsCost = pointsCost;
    if (quantity !== undefined) updateData.quantity = quantity;
    if (available !== undefined) updateData.available = available;

    const updatedReward = await prisma.reward.update({
      where: { id: rewardId },
      data: updateData,
    });

    return res.status(200).json({
      message: "Reward updated",
      reward: updatedReward,
    });
  } catch (error) {
    console.error("[GAMIFICATION] Update reward error:", error);
    return res.status(500).json({
      error: "Failed to update reward",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ VERIFY REWARD CLAIM ============

export const verifyRewardClaim = async (req, res) => {
  const { claimId } = req.params;
  const { approved, feedback } = req.body;

  if (typeof approved !== "boolean") {
    return res.status(400).json({
      error: "Approval status is required",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const claim = await prisma.rewardClaim.findUnique({
      where: { id: claimId },
      include: { reward: true },
    });

    if (!claim) {
      return res.status(404).json({
        error: "Claim not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    if (claim.status !== STATUS.PENDING) {
      return res.status(400).json({
        error: "Claim is not pending",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    const newStatus = approved ? STATUS.APPROVED : STATUS.DENIED;

    const transactionOps = [
      prisma.rewardClaim.update({
        where: { id: claimId },
        data: {
          status: newStatus,
          feedback,
        },
      }),
    ];

    // Refund points if denied
    if (!approved) {
      transactionOps.push(
        prisma.userPoints.update({
          where: { userId: claim.userId },
          data: {
            currentPoints: { increment: claim.reward.pointsCost },
          },
        })
      );

      if (claim.reward.quantity !== null) {
        transactionOps.push(
          prisma.reward.update({
            where: { id: claim.rewardId },
            data: {
              quantity: { increment: 1 },
              available: true,
            },
          })
        );
      }
    }

    const [updatedClaim] = await prisma.$transaction(transactionOps);

    const notificationType = approved ? "reward_approved" : "reward_denied";
    const notificationTitle = approved ? "Reward Approved!" : "Reward Denied";
    const notificationMessage = approved
      ? `Your claim for ${claim.reward.name} has been approved!`
      : `Your claim for ${claim.reward.name} was denied. Points refunded. ${feedback || ""}`;

    await sendPushAndNotification(
      claim.userId,
      notificationType,
      notificationTitle,
      notificationMessage,
      { claimId }
    );

    return res.status(200).json({
      message: `Claim ${approved ? "approved" : "denied"}`,
      claim: updatedClaim,
    });
  } catch (error) {
    console.error("[GAMIFICATION] Verify reward claim error:", error);
    return res.status(500).json({
      error: "Failed to process claim",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ PENDING CLAIMS ============

export const getPendingClaims = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  try {
    const pagination = paginate(parseInt(page), parseInt(limit));

    const [claims, total] = await Promise.all([
      prisma.rewardClaim.findMany({
        where: { status: STATUS.PENDING },
        include: {
          reward: true,
          user: {
            select: {
              id: true,
              fullName: true,
              username: true,
              photoUrl: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
        ...pagination,
      }),
      prisma.rewardClaim.count({ where: { status: STATUS.PENDING } }),
    ]);

    return res.status(200).json({
      claims,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[GAMIFICATION] Get pending claims error:", error);
    return res.status(500).json({
      error: "Failed to get pending claims",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ USER CLAIMS ============

export const getUserClaims = async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 20, status } = req.query;

  try {
    const pagination = paginate(parseInt(page), parseInt(limit));
    const where = { userId };
    if (status) where.status = status;

    const [claims, total] = await Promise.all([
      prisma.rewardClaim.findMany({
        where,
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
      prisma.rewardClaim.count({ where }),
    ]);

    return res.status(200).json({
      claims,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[GAMIFICATION] Get user claims error:", error);
    return res.status(500).json({
      error: "Failed to get user claims",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};