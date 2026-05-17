import { prisma } from "../prisma/prisma.js";
import { v4 as uuid } from "uuid";
import { sendPushAndNotification } from "./notifications.js";
import { NOTIFICATION_TYPES } from "../shared/utils.js";

// ============ SOCIAL SERVICE ============

export const createSocialInteraction = async (initiatorId, receiverId, type) => {
  return await prisma.socialInteraction.create({
    data: {
      id: uuid(),
      initiatorId,
      receiverId,
      type,
      status: "pending",
      createdAt: new Date(),
    },
  });
};

export const confirmSocialInteraction = async (interactionId, accept) => {
  return await prisma.socialInteraction.update({
    where: { id: interactionId },
    data: {
      status: accept ? "accepted" : "rejected",
      confirmedAt: new Date(),
    },
  });
};

// ============ SOCIAL CONTROLLERS ============

export const initiateInteraction = async (req, res) => {
  try {
    const { receiverId, type } = req.body;

    if (!receiverId || !type) {
      return res.status(400).json({ error: "Receiver ID and type are required" });
    }

    if (receiverId === req.userId) {
      return res.status(400).json({ error: "Cannot interact with yourself" });
    }

    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
    });

    if (!receiver) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check for existing pending interaction
    const existing = await prisma.socialInteraction.findFirst({
      where: {
        initiatorId: req.userId,
        receiverId,
        status: "pending",
      },
    });

    if (existing) {
      return res.status(400).json({ error: "Pending interaction already exists" });
    }

    const interaction = await createSocialInteraction(req.userId, receiverId, type);

    await sendPushAndNotification(
      receiverId,
      NOTIFICATION_TYPES.SOCIAL_REQUEST,
      "New Interaction Request",
      `Someone wants to connect with you`,
      { interactionId: interaction.id, initiatorId: req.userId, type }
    );

    // Emit socket event
    const io = req.app.get("io");
    io.to(`user-${receiverId}`).emit("social:request", interaction);

    res.status(201).json({
      message: "Interaction initiated successfully",
      interaction,
    });
  } catch (error) {
    console.error("[SOCIAL] Initiate interaction error:", error);
    res.status(500).json({ error: "Failed to initiate interaction" });
  }
};

export const confirmInteraction = async (req, res) => {
  try {
    const { interactionId } = req.params;
    const { accept } = req.body;

    const interaction = await prisma.socialInteraction.findUnique({
      where: { id: interactionId },
    });

    if (!interaction) {
      return res.status(404).json({ error: "Interaction not found" });
    }

    if (interaction.receiverId !== req.userId) {
      return res.status(403).json({ error: "Not authorized to confirm this interaction" });
    }

    if (interaction.status !== "pending") {
      return res.status(400).json({ error: "Interaction already processed" });
    }

    const updated = await confirmSocialInteraction(interactionId, accept);

    // Award points if accepted
    if (accept) {
      await prisma.userPoints.update({
        where: { userId: interaction.initiatorId },
        data: {
          currentPoints: { increment: 25 },
          totalPoints: { increment: 25 },
        },
      });

      await prisma.userPoints.update({
        where: { userId: req.userId },
        data: {
          currentPoints: { increment: 25 },
          totalPoints: { increment: 25 },
        },
      });
    }

    await sendPushAndNotification(
      interaction.initiatorId,
      accept ? NOTIFICATION_TYPES.SOCIAL_ACCEPTED : NOTIFICATION_TYPES.SOCIAL_REJECTED,
      accept ? "Connection Accepted" : "Connection Declined",
      accept ? "Your connection request was accepted! +25 points" : "Your connection request was declined",
      { interactionId, accepted: accept }
    );

    // Emit socket event
    const io = req.app.get("io");
    io.to(`user-${interaction.initiatorId}`).emit("social:response", updated);

    res.status(200).json({
      message: `Interaction ${accept ? "accepted" : "rejected"} successfully`,
      interaction: updated,
    });
  } catch (error) {
    console.error("[SOCIAL] Confirm interaction error:", error);
    res.status(500).json({ error: "Failed to confirm interaction" });
  }
};

export const getMyInteractions = async (req, res) => {
  try {
    const { limit = 20, offset = 0, status } = req.query;

    const interactions = await prisma.socialInteraction.findMany({
      where: {
        OR: [{ initiatorId: req.userId }, { receiverId: req.userId }],
        ...(status && { status }),
      },
      include: {
        initiator: {
          select: { id: true, fullName: true, username: true, photo: true },
        },
        receiver: {
          select: { id: true, fullName: true, username: true, photo: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    res.status(200).json(interactions);
  } catch (error) {
    console.error("[SOCIAL] Get interactions error:", error);
    res.status(500).json({ error: "Failed to get interactions" });
  }
};

export const getPendingRequests = async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const requests = await prisma.socialInteraction.findMany({
      where: {
        receiverId: req.userId,
        status: "pending",
      },
      include: {
        initiator: {
          select: { id: true, fullName: true, username: true, photo: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    res.status(200).json(requests);
  } catch (error) {
    console.error("[SOCIAL] Get pending requests error:", error);
    res.status(500).json({ error: "Failed to get pending requests" });
  }
};