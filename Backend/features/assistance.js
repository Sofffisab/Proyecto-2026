import { prisma } from "../prisma/prisma.js";
import {
  ERROR_CODES,
  STATUS,
  ROLES,
  paginate,
  validateRating,
  getGymPointsSettings,
} from "../shared/utils.js";
import { sendPushAndNotification } from "./notifications.js";
import { emitToTrainers, emitToUser } from "../shared/socket.js";

// ============ HELP REQUESTS ============

export const requestHelp = async (req, res) => {
  const { description } = req.body;

  if (!description) {
    return res.status(400).json({
      error: "Description is required",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const activeCheckIn = await prisma.checkIn.findFirst({
      where: {
        userId: req.user.id,
        exitTime: null,
      },
    });

    if (!activeCheckIn) {
      return res.status(400).json({
        error: "You must be checked in to request help",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    const existingRequest = await prisma.helpRequest.findFirst({
      where: {
        userId: req.user.id,
        status: { in: [STATUS.PENDING, STATUS.CLAIMED] },
      },
    });

    if (existingRequest) {
      return res.status(400).json({
        error: "You already have an active help request",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    const helpRequest = await prisma.helpRequest.create({
      data: {
        userId: req.user.id,
        description,
        status: STATUS.PENDING,
      },
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
    });

    const io = req.app.get("io");
    emitToTrainers(io, "new_help_request", {
      helpRequest,
    });

    return res.status(201).json({
      message: "Help request submitted",
      helpRequest,
    });
  } catch (error) {
    console.error("[ASSISTANCE] Request help error:", error);
    return res.status(500).json({
      error: "Failed to submit help request",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const getPendingHelpRequests = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  try {
    const pagination = paginate(parseInt(page), parseInt(limit));

    const [requests, total] = await Promise.all([
      prisma.helpRequest.findMany({
        where: { status: STATUS.PENDING },
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
        orderBy: { requestedAt: "asc" },
        ...pagination,
      }),
      prisma.helpRequest.count({ where: { status: STATUS.PENDING } }),
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
    console.error("[ASSISTANCE] Get pending help requests error:", error);
    return res.status(500).json({
      error: "Failed to get help requests",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const claimHelpRequest = async (req, res) => {
  const { helpId } = req.params;

  try {
    const helpRequest = await prisma.helpRequest.findUnique({
      where: { id: helpId },
    });

    if (!helpRequest) {
      return res.status(404).json({
        error: "Help request not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    if (helpRequest.status !== STATUS.PENDING) {
      return res.status(400).json({
        error: "Help request is no longer pending",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    const updatedRequest = await prisma.helpRequest.update({
      where: { id: helpId },
      data: {
        status: STATUS.CLAIMED,
        claimedBy: req.user.id,
        claimedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
        trainer: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
      },
    });

    await sendPushAndNotification(
      helpRequest.userId,
      "help_claimed",
      "Help is on the way!",
      `${req.user.fullName} is coming to help you.`,
      { helpId }
    );

    const io = req.app.get("io");
    emitToTrainers(io, "help_request_claimed", {
      helpId,
      claimedBy: req.user.id,
    });

    return res.status(200).json({
      message: "Help request claimed",
      helpRequest: updatedRequest,
    });
  } catch (error) {
    console.error("[ASSISTANCE] Claim help request error:", error);
    return res.status(500).json({
      error: "Failed to claim help request",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const completeHelpRequestCtrl = async (req, res) => {
  const { helpId } = req.params;
  const { feedback } = req.body;

  try {
    const helpRequest = await prisma.helpRequest.findUnique({
      where: { id: helpId },
    });

    if (!helpRequest) {
      return res.status(404).json({
        error: "Help request not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    if (helpRequest.claimedBy !== req.user.id) {
      return res.status(403).json({
        error: "You did not claim this help request",
        code: ERROR_CODES.FORBIDDEN,
      });
    }

    if (helpRequest.status !== STATUS.CLAIMED) {
      return res.status(400).json({
        error: "Help request is not in claimed status",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    const settings = await getGymPointsSettings();

    const [updatedRequest, _] = await prisma.$transaction([
      prisma.helpRequest.update({
        where: { id: helpId },
        data: {
          status: STATUS.COMPLETED,
          feedback,
          completedAt: new Date(),
        },
      }),
      prisma.userPoints.update({
        where: { userId: helpRequest.userId },
        data: {
          totalPoints: { increment: settings.pointsPerHelpReceived },
          currentPoints: { increment: settings.pointsPerHelpReceived },
        },
      }),
    ]);

    await sendPushAndNotification(
      helpRequest.userId,
      "help_completed",
      "Help Completed",
      `Your help request was completed. You earned ${settings.pointsPerHelpReceived} points!`,
      { helpId }
    );

    return res.status(200).json({
      message: "Help request completed",
      helpRequest: updatedRequest,
      pointsAwarded: settings.pointsPerHelpReceived,
    });
  } catch (error) {
    console.error("[ASSISTANCE] Complete help request error:", error);
    return res.status(500).json({
      error: "Failed to complete help request",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const rateHelp = async (req, res) => {
  const { helpId } = req.params;
  const { rating, comment } = req.body;

  if (!validateRating(rating)) {
    return res.status(400).json({
      error: "Rating must be between 1 and 5",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const helpRequest = await prisma.helpRequest.findUnique({
      where: { id: helpId },
    });

    if (!helpRequest) {
      return res.status(404).json({
        error: "Help request not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    // Validate ownership
    if (helpRequest.userId !== req.user.id) {
      return res.status(403).json({
        error: "You can only rate your own help requests",
        code: ERROR_CODES.FORBIDDEN,
      });
    }

    // Validate status
    if (helpRequest.status !== STATUS.COMPLETED) {
      return res.status(400).json({
        error: "Help request must be completed before rating",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    // Check if already rated
    if (helpRequest.rating !== null) {
      return res.status(400).json({
        error: "Help request has already been rated",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    const updatedRequest = await prisma.helpRequest.update({
      where: { id: helpId },
      data: {
        rating,
        comment,
      },
    });

    return res.status(200).json({
      message: "Rating submitted",
      helpRequest: updatedRequest,
    });
  } catch (error) {
    console.error("[ASSISTANCE] Rate help error:", error);
    return res.status(500).json({
      error: "Failed to submit rating",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const getMyHelpRequests = async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;

  try {
    const pagination = paginate(parseInt(page), parseInt(limit));
    const where = { userId: req.user.id };
    if (status) where.status = status;

    const [requests, total] = await Promise.all([
      prisma.helpRequest.findMany({
        where,
        include: {
          trainer: {
            select: {
              id: true,
              fullName: true,
              username: true,
              photoUrl: true,
            },
          },
        },
        orderBy: { requestedAt: "desc" },
        ...pagination,
      }),
      prisma.helpRequest.count({ where }),
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
    console.error("[ASSISTANCE] Get my help requests error:", error);
    return res.status(500).json({
      error: "Failed to get help requests",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const cancelHelpRequest = async (req, res) => {
  const { helpId } = req.params;

  try {
    const helpRequest = await prisma.helpRequest.findUnique({
      where: { id: helpId },
    });

    if (!helpRequest) {
      return res.status(404).json({
        error: "Help request not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    if (helpRequest.userId !== req.user.id) {
      return res.status(403).json({
        error: "You can only cancel your own help requests",
        code: ERROR_CODES.FORBIDDEN,
      });
    }

    if (helpRequest.status !== STATUS.PENDING) {
      return res.status(400).json({
        error: "Can only cancel pending help requests",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    const updatedRequest = await prisma.helpRequest.update({
      where: { id: helpId },
      data: { status: STATUS.CANCELLED },
    });

    const io = req.app.get("io");
    emitToTrainers(io, "help_request_cancelled", { helpId });

    return res.status(200).json({
      message: "Help request cancelled",
      helpRequest: updatedRequest,
    });
  } catch (error) {
    console.error("[ASSISTANCE] Cancel help request error:", error);
    return res.status(500).json({
      error: "Failed to cancel help request",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ PROGRESS ============

export const submitProgress = async (req, res) => {
  const { exerciseName, weight, reps, notes, photoUrl } = req.body;

  if (!exerciseName || weight === undefined || reps === undefined) {
    return res.status(400).json({
      error: "Exercise name, weight, and reps are required",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const progress = await prisma.progressUpdate.create({
      data: {
        userId: req.user.id,
        exerciseName,
        weight,
        reps,
        notes,
        photoUrl,
        status: STATUS.PENDING,
      },
    });

    const io = req.app.get("io");
    emitToTrainers(io, "new_progress_update", {
      progress,
      user: {
        id: req.user.id,
        fullName: req.user.fullName,
        username: req.user.username,
      },
    });

    return res.status(201).json({
      message: "Progress submitted for verification",
      progress,
    });
  } catch (error) {
    console.error("[ASSISTANCE] Submit progress error:", error);
    return res.status(500).json({
      error: "Failed to submit progress",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const getPendingProgress = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  try {
    const pagination = paginate(parseInt(page), parseInt(limit));

    const [updates, total] = await Promise.all([
      prisma.progressUpdate.findMany({
        where: { status: STATUS.PENDING },
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
        orderBy: { createdAt: "asc" },
        ...pagination,
      }),
      prisma.progressUpdate.count({ where: { status: STATUS.PENDING } }),
    ]);

    return res.status(200).json({
      updates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[ASSISTANCE] Get pending progress error:", error);
    return res.status(500).json({
      error: "Failed to get pending progress",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const verifyProgressCtrl = async (req, res) => {
  const { progressId } = req.params;
  const { approved, feedback } = req.body;

  if (typeof approved !== "boolean") {
    return res.status(400).json({
      error: "Approval status is required",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const progress = await prisma.progressUpdate.findUnique({
      where: { id: progressId },
    });

    if (!progress) {
      return res.status(404).json({
        error: "Progress update not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    if (progress.status !== STATUS.PENDING) {
      return res.status(400).json({
        error: "Progress update is not pending",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    const settings = await getGymPointsSettings();
    const newStatus = approved ? STATUS.APPROVED : STATUS.DENIED;

    const transactionOps = [
      prisma.progressUpdate.update({
        where: { id: progressId },
        data: {
          status: newStatus,
          feedback,
          verifiedBy: req.user.id,
          verifiedAt: new Date(),
        },
      }),
    ];

    if (approved) {
      transactionOps.push(
        prisma.userPoints.update({
          where: { userId: progress.userId },
          data: {
            totalPoints: { increment: settings.pointsPerProgressVerified },
            currentPoints: { increment: settings.pointsPerProgressVerified },
          },
        })
      );
    }

    const [updatedProgress] = await prisma.$transaction(transactionOps);

    const notificationType = approved ? "progress_approved" : "progress_denied";
    const notificationTitle = approved ? "Progress Approved!" : "Progress Denied";
    const notificationMessage = approved
      ? `Your progress was verified! You earned ${settings.pointsPerProgressVerified} points.`
      : `Your progress was not approved. ${feedback || ""}`;

    await sendPushAndNotification(
      progress.userId,
      notificationType,
      notificationTitle,
      notificationMessage,
      { progressId }
    );

    return res.status(200).json({
      message: `Progress ${approved ? "approved" : "denied"}`,
      progress: updatedProgress,
      pointsAwarded: approved ? settings.pointsPerProgressVerified : 0,
    });
  } catch (error) {
    console.error("[ASSISTANCE] Verify progress error:", error);
    return res.status(500).json({
      error: "Failed to verify progress",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const getMyProgress = async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;

  try {
    const pagination = paginate(parseInt(page), parseInt(limit));
    const where = { userId: req.user.id };
    if (status) where.status = status;

    const [updates, total] = await Promise.all([
      prisma.progressUpdate.findMany({
        where,
        include: {
          trainer: {
            select: {
              id: true,
              fullName: true,
              username: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        ...pagination,
      }),
      prisma.progressUpdate.count({ where }),
    ]);

    return res.status(200).json({
      updates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[ASSISTANCE] Get my progress error:", error);
    return res.status(500).json({
      error: "Failed to get progress",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};