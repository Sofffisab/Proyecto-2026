import { prisma } from "../prisma/prisma.js";
import { v4 as uuid } from "uuid";
import { sendPushAndNotification } from "./notifications.js";
import { NOTIFICATION_TYPES } from "../shared/utils.js";

// ============ POINTS SERVICE ============

export const ensureUserPoints = async (userId) => {
  let points = await prisma.userPoints.findUnique({
    where: { userId },
  });

  if (!points) {
    points = await prisma.userPoints.create({
      data: {
        userId,
        totalPoints: 0,
        currentPoints: 0,
      },
    });
  }

  return points;
};

export const addPoints = async (userId, amount, reason = "activity") => {
  await ensureUserPoints(userId);

  const points = await prisma.userPoints.update({
    where: { userId },
    data: {
      currentPoints: { increment: amount },
      totalPoints: { increment: amount },
    },
  });

  return points;
};

export const deductPoints = async (userId, amount, reason = "reward") => {
  await ensureUserPoints(userId);

  const points = await prisma.userPoints.update({
    where: { userId },
    data: {
      currentPoints: { decrement: amount },
    },
  });

  return points;
};

export const getUserPoints = async (userId) => {
  return await ensureUserPoints(userId);
};

// ============ POINTS CONTROLLERS ============

export const getPoints = async (req, res) => {
  try {
    const { userId } = req.params;

    const points = await getUserPoints(userId);

    res.status(200).json(points);
  } catch (error) {
    console.error("[POINTS] Get points error:", error);
    res.status(500).json({ error: "Failed to get points" });
  }
};

export const addPointsManual = async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, reason } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }

    const points = await addPoints(userId, amount, reason || "manual");

    await sendPushAndNotification(
      userId,
      NOTIFICATION_TYPES.POINTS_EARNED,
      "Points Awarded",
      `You earned ${amount} points: ${reason || "manual award"}`,
      { points: amount, reason }
    );

    res.status(200).json({
      message: "Points added successfully",
      points,
    });
  } catch (error) {
    console.error("[POINTS] Add points error:", error);
    res.status(500).json({ error: "Failed to add points" });
  }
};

export const deductPointsManual = async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, reason } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }

    const userPoints = await getUserPoints(userId);

    if (userPoints.currentPoints < amount) {
      return res.status(400).json({ error: "Insufficient points" });
    }

    const points = await deductPoints(userId, amount, reason || "manual");

    await sendPushAndNotification(
      userId,
      NOTIFICATION_TYPES.POINTS_DEDUCTED,
      "Points Deducted",
      `${amount} points were deducted: ${reason || "manual deduction"}`,
      { points: amount, reason }
    );

    res.status(200).json({
      message: "Points deducted successfully",
      points,
    });
  } catch (error) {
    console.error("[POINTS] Deduct points error:", error);
    res.status(500).json({ error: "Failed to deduct points" });
  }
};

export const getLeaderboard = async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.query;

    const leaderboard = await prisma.userPoints.findMany({
      orderBy: { totalPoints: "desc" },
      take: parseInt(limit),
      skip: parseInt(offset),
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            photo: true,
          },
        },
      },
    });

    res.status(200).json(leaderboard);
  } catch (error) {
    console.error("[GAMIFICATION] Get leaderboard error:", error);
    res.status(500).json({ error: "Failed to get leaderboard" });
  }
};

// ============ REWARDS SERVICE ============

export const claimRewardLogic = async (userId, rewardId) => {
  const reward = await prisma.reward.findUnique({
    where: { id: rewardId },
  });

  if (!reward) return null;

  const userPoints = await getUserPoints(userId);

  if (userPoints.currentPoints < reward.pointsCost) {
    throw new Error("Insufficient points");
  }

  const claim = await prisma.rewardClaim.create({
    data: {
      id: uuid(),
      rewardId,
      userId,
      status: "pending",
    },
  });

  return claim;
};

export const verifyRewardLogic = async (claimId, approve, feedback = null) => {
  const claim = await prisma.rewardClaim.findUnique({
    where: { id: claimId },
  });

  if (!claim) return null;

  if (approve) {
    await deductPoints(claim.userId, (await prisma.reward.findUnique({ where: { id: claim.rewardId } })).pointsCost);
  }

  const updatedClaim = await prisma.rewardClaim.update({
    where: { id: claimId },
    data: {
      status: approve ? "approved" : "denied",
      feedback,
    },
  });

  return updatedClaim;
};

// ============ REWARDS CONTROLLERS ============

export const getRewards = async (req, res) => {
  try {
    const rewards = await prisma.reward.findMany({
      where: { available: true },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(rewards);
  } catch (error) {
    console.error("[REWARDS] Get rewards error:", error);
    res.status(500).json({ error: "Failed to get rewards" });
  }
};

export const createReward = async (req, res) => {
  try {
    const { name, description, pointsCost, quantity } = req.body;

    if (!name || !pointsCost) {
      return res.status(400).json({ error: "Name and points cost are required" });
    }

    const reward = await prisma.reward.create({
      data: {
        id: uuid(),
        name,
        description,
        pointsCost,
        quantity: quantity || null,
        available: true,
      },
    });

    res.status(201).json({
      message: "Reward created successfully",
      reward,
    });
  } catch (error) {
    console.error("[REWARDS] Create reward error:", error);
    res.status(500).json({ error: "Failed to create reward" });
  }
};

export const updateReward = async (req, res) => {
  try {
    const { rewardId } = req.params;
    const { name, description, pointsCost, quantity, available } = req.body;

    const reward = await prisma.reward.update({
      where: { id: rewardId },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(pointsCost && { pointsCost }),
        ...(quantity !== undefined && { quantity }),
        ...(available !== undefined && { available }),
      },
    });

    res.status(200).json({
      message: "Reward updated successfully",
      reward,
    });
  } catch (error) {
    console.error("[REWARDS] Update reward error:", error);
    res.status(500).json({ error: "Failed to update reward" });
  }
};

export const claimReward = async (req, res) => {
  try {
    const { rewardId } = req.body;

    if (!rewardId) {
      return res.status(400).json({ error: "Reward ID is required" });
    }

    const claim = await claimRewardLogic(req.userId, rewardId);

    if (!claim) {
      return res.status(404).json({ error: "Reward not found" });
    }

    await sendPushAndNotification(
      req.userId,
      NOTIFICATION_TYPES.REWARD_CLAIMED,
      "Reward Claim Pending",
      "Your reward claim is pending verification",
      { claimId: claim.id }
    );

    res.status(201).json({
      message: "Reward claimed successfully",
      claim,
    });
  } catch (error) {
    console.error("[REWARDS] Claim reward error:", error);
    res.status(500).json({
      error: error.message || "Failed to claim reward",
    });
  }
};

export const verifyRewardClaim = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { approve, feedback } = req.body;

    const updatedClaim = await verifyRewardLogic(claimId, approve, feedback);

    if (!updatedClaim) {
      return res.status(404).json({ error: "Claim not found" });
    }

    await sendPushAndNotification(
      updatedClaim.userId,
      approve ? NOTIFICATION_TYPES.REWARD_APPROVED : NOTIFICATION_TYPES.REWARD_DENIED,
      approve ? "Reward Approved" : "Reward Denied",
      approve ? "Your reward has been approved" : `Your reward was denied: ${feedback || ""}`,
      { claimId: updatedClaim.id }
    );

    res.status(200).json({
      message: `Reward ${approve ? "approved" : "denied"} successfully`,
      claim: updatedClaim,
    });
  } catch (error) {
    console.error("[REWARDS] Verify reward error:", error);
    res.status(500).json({ error: "Failed to verify reward" });
  }
};

export const getPendingClaims = async (req, res) => {
  try {
    const claims = await prisma.rewardClaim.findMany({
      where: { status: "pending" },
      include: {
        user: { select: { id: true, fullName: true, username: true } },
        reward: true,
      },
      orderBy: { createdAt: "asc" },
    });

    res.status(200).json(claims);
  } catch (error) {
    console.error("[REWARDS] Get pending claims error:", error);
    res.status(500).json({ error: "Failed to get pending claims" });
  }
};

export const getUserClaims = async (req, res) => {
  try {
    const { userId } = req.params;

    const claims = await prisma.rewardClaim.findMany({
      where: { userId },
      include: { reward: true },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(claims);
  } catch (error) {
    console.error("[REWARDS] Get user claims error:", error);
    res.status(500).json({ error: "Failed to get user claims" });
  }
};