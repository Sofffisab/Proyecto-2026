import { prisma } from "../prisma/prisma.js";
import { ERROR_CODES, STATUS, paginate, getGymPointsSettings } from "../shared/utils.js";
import { sendPushAndNotification } from "./notifications.js";
import { emitToUser } from "../shared/socket.js";

// ============ SOCIAL REQUESTS ============

export const sendSocialRequest = async (req, res) => {
  const { receiverId, type } = req.body;

  if (!receiverId || !type) {
    return res.status(400).json({
      error: "Receiver ID and type are required",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  if (receiverId === req.user.id) {
    return res.status(400).json({
      error: "Cannot send request to yourself",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
      include: {
        settings: {
          select: { allowSocialRequests: true },
        },
      },
    });

    if (!receiver) {
      return res.status(404).json({
        error: "User not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    // Check if receiver allows social requests
    if (receiver.settings && !receiver.settings.allowSocialRequests) {
      return res.status(403).json({
        error: "User does not accept social requests",
        code: ERROR_CODES.FORBIDDEN,
      });
    }

    const existingInteraction = await prisma.socialInteraction.findFirst({
      where: {
        OR: [
          { initiatorId: req.user.id, receiverId },
          { initiatorId: receiverId, receiverId: req.user.id },
        ],
        status: { in: [STATUS.PENDING, STATUS.ACCEPTED] },
      },
    });

    if (existingInteraction) {
      return res.status(400).json({
        error: "An interaction already exists with this user",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    const interaction = await prisma.socialInteraction.create({
      data: {
        initiatorId: req.user.id,
        receiverId,
        type,
        status: STATUS.PENDING,
      },
      include: {
        initiator: {
          select: {
            id: true,
            fullName: true,
            username: true,
            photoUrl: true,
          },
        },
      },
    });

    await sendPushAndNotification(
      receiverId,
      "social_request",
      "New Connection Request",
      `${req.user.fullName} wants to connect with you.`,
      { interactionId: interaction.id }
    );

    const io = req.app.get("io");
    emitToUser(io, receiverId, "new_social_request", { interaction });

    return res.status(201).json({
      message: "Social request sent",
      interaction,
    });
  } catch (error) {
    console.error("[SOCIAL] Send social request error:", error);
    return res.status(500).json({
      error: "Failed to send social request",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const respondToSocialRequest = async (req, res) => {
  const { interactionId } = req.params;
  const { accept } = req.body;

  if (typeof accept !== "boolean") {
    return res.status(400).json({
      error: "Accept status is required",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const interaction = await prisma.socialInteraction.findUnique({
      where: { id: interactionId },
      include: {
        initiator: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
      },
    });

    if (!interaction) {
      return res.status(404).json({
        error: "Interaction not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    if (interaction.receiverId !== req.user.id) {
      return res.status(403).json({
        error: "You cannot respond to this request",
        code: ERROR_CODES.FORBIDDEN,
      });
    }

    if (interaction.status !== STATUS.PENDING) {
      return res.status(400).json({
        error: "Request is no longer pending",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    const newStatus = accept ? STATUS.ACCEPTED : STATUS.REJECTED;

    const updatedInteraction = await prisma.socialInteraction.update({
      where: { id: interactionId },
      data: { status: newStatus },
    });

    const notificationType = accept ? "social_accepted" : "social_rejected";
    const notificationTitle = accept ? "Request Accepted" : "Request Declined";
    const notificationMessage = accept
      ? `${req.user.fullName} accepted your connection request.`
      : `${req.user.fullName} declined your connection request.`;

    await sendPushAndNotification(
      interaction.initiatorId,
      notificationType,
      notificationTitle,
      notificationMessage,
      { interactionId }
    );

    const io = req.app.get("io");
    emitToUser(io, interaction.initiatorId, "social_response", {
      interactionId,
      accepted: accept,
    });

    return res.status(200).json({
      message: `Request ${accept ? "accepted" : "rejected"}`,
      interaction: updatedInteraction,
    });
  } catch (error) {
    console.error("[SOCIAL] Respond to social request error:", error);
    return res.status(500).json({
      error: "Failed to respond to request",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const confirmInteraction = async (req, res) => {
  const { interactionId } = req.params;

  try {
    const interaction = await prisma.socialInteraction.findUnique({
      where: { id: interactionId },
    });

    if (!interaction) {
      return res.status(404).json({
        error: "Interaction not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    if (interaction.initiatorId !== req.user.id && interaction.receiverId !== req.user.id) {
      return res.status(403).json({
        error: "You are not part of this interaction",
        code: ERROR_CODES.FORBIDDEN,
      });
    }

    if (interaction.status !== STATUS.ACCEPTED) {
      return res.status(400).json({
        error: "Interaction must be accepted first",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    if (interaction.confirmedAt) {
      return res.status(400).json({
        error: "Interaction already confirmed",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    const settings = await getGymPointsSettings();

    const [updatedInteraction] = await prisma.$transaction([
      prisma.socialInteraction.update({
        where: { id: interactionId },
        data: { confirmedAt: new Date() },
      }),
      prisma.userPoints.update({
        where: { userId: interaction.initiatorId },
        data: {
          totalPoints: { increment: settings.pointsPerSocialConnection },
          currentPoints: { increment: settings.pointsPerSocialConnection },
        },
      }),
      prisma.userPoints.update({
        where: { userId: interaction.receiverId },
        data: {
          totalPoints: { increment: settings.pointsPerSocialConnection },
          currentPoints: { increment: settings.pointsPerSocialConnection },
        },
      }),
    ]);

    const otherUserId =
      interaction.initiatorId === req.user.id
        ? interaction.receiverId
        : interaction.initiatorId;

    await sendPushAndNotification(
      otherUserId,
      "points_earned",
      "Connection Confirmed!",
      `You earned ${settings.pointsPerSocialConnection} points for your connection!`,
      { interactionId }
    );

    return res.status(200).json({
      message: "Interaction confirmed",
      interaction: updatedInteraction,
      pointsAwarded: settings.pointsPerSocialConnection,
    });
  } catch (error) {
    console.error("[SOCIAL] Confirm interaction error:", error);
    return res.status(500).json({
      error: "Failed to confirm interaction",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const getMySocialRequests = async (req, res) => {
  const { page = 1, limit = 20, type } = req.query;

  try {
    const pagination = paginate(parseInt(page), parseInt(limit));

    const where = {
      OR: [{ initiatorId: req.user.id }, { receiverId: req.user.id }],
    };

    if (type === "sent") {
      where.OR = [{ initiatorId: req.user.id }];
    } else if (type === "received") {
      where.OR = [{ receiverId: req.user.id }];
    }

    const [interactions, total] = await Promise.all([
      prisma.socialInteraction.findMany({
        where,
        include: {
          initiator: {
            select: {
              id: true,
              fullName: true,
              username: true,
              photoUrl: true,
            },
          },
          receiver: {
            select: {
              id: true,
              fullName: true,
              username: true,
              photoUrl: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        ...pagination,
      }),
      prisma.socialInteraction.count({ where }),
    ]);

    return res.status(200).json({
      interactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[SOCIAL] Get my social requests error:", error);
    return res.status(500).json({
      error: "Failed to get social requests",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const getConnections = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  try {
    const pagination = paginate(parseInt(page), parseInt(limit));

    const where = {
      OR: [{ initiatorId: req.user.id }, { receiverId: req.user.id }],
      status: STATUS.ACCEPTED,
    };

    const [interactions, total] = await Promise.all([
      prisma.socialInteraction.findMany({
        where,
        include: {
          initiator: {
            select: {
              id: true,
              fullName: true,
              username: true,
              photoUrl: true,
            },
          },
          receiver: {
            select: {
              id: true,
              fullName: true,
              username: true,
              photoUrl: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        ...pagination,
      }),
      prisma.socialInteraction.count({ where }),
    ]);

    const connections = interactions.map((i) => {
      const connection =
        i.initiatorId === req.user.id ? i.receiver : i.initiator;
      return {
        ...connection,
        interactionId: i.id,
        confirmedAt: i.confirmedAt,
        type: i.type,
      };
    });

    return res.status(200).json({
      connections,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[SOCIAL] Get connections error:", error);
    return res.status(500).json({
      error: "Failed to get connections",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const getPeopleAtGym = async (req, res) => {
  try {
    const activeCheckIns = await prisma.checkIn.findMany({
      where: {
        exitTime: null,
        userId: { not: req.user.id },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            photoUrl: true,
            settings: {
              select: { allowSocialRequests: true },
            },
          },
        },
      },
    });

    const people = activeCheckIns
      .map((ci) => ({
        id: ci.user.id,
        fullName: ci.user.fullName,
        username: ci.user.username,
        photoUrl: ci.user.photoUrl,
        checkedInAt: ci.entryTime,
        allowSocialRequests: ci.user.settings?.allowSocialRequests ?? true,
      }))
      .filter((p) => p.allowSocialRequests);

    return res.status(200).json({ people });
  } catch (error) {
    console.error("[SOCIAL] Get people at gym error:", error);
    return res.status(500).json({
      error: "Failed to get people at gym",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ ALIASES FOR ROUTES ============

export const initiateInteraction = sendSocialRequest;
export const getMyInteractions = getMySocialRequests;

// ============ PENDING REQUESTS ============

export const getPendingRequests = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  try {
    const pagination = paginate(parseInt(page), parseInt(limit));

    const [requests, total] = await Promise.all([
      prisma.socialInteraction.findMany({
        where: {
          receiverId: req.user.id,
          status: STATUS.PENDING,
        },
        include: {
          initiator: {
            select: {
              id: true,
              fullName: true,
              username: true,
              photoUrl: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        ...pagination,
      }),
      prisma.socialInteraction.count({
        where: {
          receiverId: req.user.id,
          status: STATUS.PENDING,
        },
      }),
    ]);

    return res.status(200).json({
      requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[SOCIAL] Get pending requests error:", error);
    return res.status(500).json({
      error: "Failed to get pending requests",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};