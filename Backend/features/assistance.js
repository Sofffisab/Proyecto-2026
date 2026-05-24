import { prisma } from "../prisma/prisma.js";
import { v4 as uuid } from "uuid";
import { sendPushAndNotification } from "./notifications.js";
import { NOTIFICATION_TYPES } from "../shared/utils.js";

// ============ HELP SERVICE ============

export const createHelpRequest = async (userId, description) => {
  return await prisma.helpRequest.create({
    data: {
      id: uuid(),
      userId,
      description,
      status: "pending",
      requestedAt: new Date(),
    },
  });
};

export const claimHelpService = async (trainerId, helpRequestId) => {
  return await prisma.helpRequest.update({
    where: { id: helpRequestId },
    data: {
      claimedBy: trainerId,
      status: "claimed",
      claimedAt: new Date(),
    },
  });
};

export const completeHelpService = async (helpRequestId, feedback = null) => {
  return await prisma.helpRequest.update({
    where: { id: helpRequestId },
    data: {
      status: "completed",
      feedback,
      completedAt: new Date(),
    },
  });
};

// ============ HELP CONTROLLERS ============

export const requestHelp = async (req, res) => {
  try {
    const { description } = req.body;

    if (!description) {
      return res.status(400).json({ error: "Description is required" });
    }

    const helpRequest = await createHelpRequest(req.userId, description);

    const trainers = await prisma.user.findMany({
      where: { role: "TRAINER" },
      select: { id: true },
    });

    for (const trainer of trainers) {
      await sendPushAndNotification(
        trainer.id,
        NOTIFICATION_TYPES.HELP_REQUESTED,
        "Help Request",
        "A user needs help",
        { helpRequestId: helpRequest.id, userId: req.userId }
      );
    }

    const io = req.app.get("io");
    io.to("trainers").emit("help:requested", helpRequest);

    res.status(201).json({
      message: "Help requested successfully",
      helpRequest,
    });
  } catch (error) {
    console.error("[HELP] Request help error:", error);
    res.status(500).json({ error: "Failed to request help" });
  }
};

export const claimHelpRequestCtrl = async (req, res) => {
  try {
    const { helpRequestId } = req.params;

    const helpRequest = await prisma.helpRequest.findUnique({
      where: { id: helpRequestId },
    });

    if (!helpRequest) {
      return res.status(404).json({ error: "Help request not found" });
    }

    if (helpRequest.status !== "pending") {
      return res.status(400).json({ error: "Help request already claimed or completed" });
    }

    const updated = await claimHelpService(req.userId, helpRequestId);

    await sendPushAndNotification(
      helpRequest.userId,
      NOTIFICATION_TYPES.HELP_CLAIMED,
      "Trainer Coming",
      "A trainer is coming to help you",
      { helpRequestId, trainerId: req.userId }
    );

    const io = req.app.get("io");
    io.to(`user-${helpRequest.userId}`).emit("help:claimed", updated);

    res.status(200).json({
      message: "Help request claimed successfully",
      helpRequest: updated,
    });
  } catch (error) {
    console.error("[HELP] Claim help error:", error);
    res.status(500).json({ error: "Failed to claim help request" });
  }
};

export const completeHelpRequestCtrl = async (req, res) => {
  try {
    const { helpRequestId } = req.params;
    const { feedback } = req.body;

    const helpRequest = await prisma.helpRequest.findUnique({
      where: { id: helpRequestId },
    });

    if (!helpRequest) {
      return res.status(404).json({ error: "Help request not found" });
    }

    const updated = await completeHelpService(helpRequestId, feedback);

    await sendPushAndNotification(
      helpRequest.userId,
      NOTIFICATION_TYPES.HELP_COMPLETED,
      "Help Completed",
      "The trainer finished assisting you",
      { helpRequestId, feedback }
    );

    await prisma.userPoints.update({
      where: { userId: helpRequest.userId },
      data: {
        currentPoints: { increment: 50 },
        totalPoints: { increment: 50 },
      },
    });

    const io = req.app.get("io");
    io.to(`user-${helpRequest.userId}`).emit("help:completed", updated);

    res.status(200).json({
      message: "Help request completed successfully",
      helpRequest: updated,
    });
  } catch (error) {
    console.error("[HELP] Complete help error:", error);
    res.status(500).json({ error: "Failed to complete help request" });
  }
};

export const rateHelp = async (req, res) => {
  try {
    const { helpRequestId } = req.params;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const helpRequest = await prisma.helpRequest.update({
      where: { id: helpRequestId },
      data: {
        rating,
        comment,
      },
    });

    res.status(200).json({
      message: "Help request rated successfully",
      helpRequest,
    });
  } catch (error) {
    console.error("[HELP] Rate help error:", error);
    res.status(500).json({ error: "Failed to rate help request" });
  }
};

export const getPendingHelpRequests = async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.query;

    const helpRequests = await prisma.helpRequest.findMany({
      where: { status: "pending" },
      include: {
        user: {
          select: { id: true, fullName: true, username: true },
        },
      },
      orderBy: { requestedAt: "asc" },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    res.status(200).json(helpRequests);
  } catch (error) {
    console.error("[HELP] Get pending requests error:", error);
    res.status(500).json({ error: "Failed to get pending requests" });
  }
};

export const getMyHelpRequests = async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.query;

    const helpRequests = await prisma.helpRequest.findMany({
      where: { userId: req.userId },
      orderBy: { requestedAt: "desc" },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    res.status(200).json(helpRequests);
  } catch (error) {
    console.error("[HELP] Get my requests error:", error);
    res.status(500).json({ error: "Failed to get your requests" });
  }
};

export const cancelHelpRequest = async (req, res) => {
  try {
    const { helpRequestId } = req.params;

    const helpRequest = await prisma.helpRequest.findUnique({
      where: { id: helpRequestId },
    });

    if (!helpRequest) {
      return res.status(404).json({ error: "Help request not found" });
    }

    if (helpRequest.userId !== req.userId && req.userRole !== "ADMIN") {
      return res.status(403).json({ error: "Not authorized to cancel this request" });
    }

    if (helpRequest.status !== "pending" && helpRequest.status !== "claimed") {
      return res.status(400).json({
        error: "Cannot cancel a completed or already cancelled request",
      });
    }

    const updated = await prisma.helpRequest.update({
      where: { id: helpRequestId },
      data: { status: "cancelled" },
    });

    if (helpRequest.claimedBy) {
      await sendPushAndNotification(
        helpRequest.claimedBy,
        NOTIFICATION_TYPES.HELP_CANCELLED,
        "Help Request Cancelled",
        "The user cancelled their help request",
        { helpRequestId }
      );

      const io = req.app.get("io");
      io.to(`user-${helpRequest.claimedBy}`).emit("help:cancelled", updated);
    }

    res.status(200).json({
      message: "Help request cancelled successfully",
      helpRequest: updated,
    });
  } catch (error) {
    console.error("[HELP] Cancel help error:", error);
    res.status(500).json({ error: "Failed to cancel help request" });
  }
};

// ============ PROGRESS SERVICE ============

export const requestProgressService = async (userId, exerciseName, weight, reps, notes = null) => {
  return await prisma.progressUpdate.create({
    data: {
      id: uuid(),
      userId,
      exerciseName,
      weight,
      reps,
      notes,
      status: "pending",
      createdAt: new Date(),
    },
  });
};

export const verifyProgressService = async (progressId, trainerId, approve, feedback = null) => {
  return await prisma.progressUpdate.update({
    where: { id: progressId },
    data: {
      status: approve ? "approved" : "denied",
      feedback,
      verifiedBy: trainerId,
      verifiedAt: new Date(),
    },
  });
};

// ============ PROGRESS CONTROLLERS ============

export const requestProgressUpdateCtrl = async (req, res) => {
  try {
    const { exerciseName, weight, reps, notes } = req.body;

    if (!exerciseName || !weight || !reps) {
      return res.status(400).json({ error: "Exercise name, weight, and reps are required" });
    }

    const progress = await requestProgressService(req.userId, exerciseName, weight, reps, notes);

    const trainers = await prisma.user.findMany({
      where: { role: "TRAINER" },
      select: { id: true },
    });

    for (const trainer of trainers) {
      await sendPushAndNotification(
        trainer.id,
        NOTIFICATION_TYPES.PROGRESS_REQUESTED,
        "Progress Verification",
        `${exerciseName}: ${weight}kg x${reps} reps`,
        { progressId: progress.id, userId: req.userId }
      );
    }

    const io = req.app.get("io");
    io.to("trainers").emit("progress:requested", progress);

    res.status(201).json({
      message: "Progress update requested successfully",
      progress,
    });
  } catch (error) {
    console.error("[PROGRESS] Request update error:", error);
    res.status(500).json({ error: "Failed to request progress update" });
  }
};

export const verifyProgressCtrl = async (req, res) => {
  try {
    const { progressId } = req.params;
    const { approve, feedback } = req.body;

    const progress = await prisma.progressUpdate.findUnique({
      where: { id: progressId },
    });

    if (!progress) {
      return res.status(404).json({ error: "Progress not found" });
    }

    const updated = await verifyProgressService(progressId, req.userId, approve, feedback);

    if (approve) {
      await prisma.userPoints.update({
        where: { userId: progress.userId },
        data: {
          currentPoints: { increment: 100 },
          totalPoints: { increment: 100 },
        },
      });

      await sendPushAndNotification(
        progress.userId,
        NOTIFICATION_TYPES.PROGRESS_APPROVED,
        "Progress Verified",
        `Your ${progress.exerciseName} progress has been verified! +100 points`,
        { progressId }
      );
    } else {
      await sendPushAndNotification(
        progress.userId,
        NOTIFICATION_TYPES.PROGRESS_DENIED,
        "Progress Not Verified",
        `Your ${progress.exerciseName} progress was not verified: ${feedback || ""}`,
        { progressId }
      );
    }

    const io = req.app.get("io");
    io.to(`user-${progress.userId}`).emit("progress:verified", updated);

    res.status(200).json({
      message: `Progress ${approve ? "approved" : "denied"} successfully`,
      progress: updated,
    });
  } catch (error) {
    console.error("[PROGRESS] Verify error:", error);
    res.status(500).json({ error: "Failed to verify progress" });
  }
};

export const getPendingProgress = async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.query;

    const pendingProgress = await prisma.progressUpdate.findMany({
      where: { status: "pending" },
      include: {
        user: {
          select: { id: true, fullName: true, username: true },
        },
      },
      orderBy: { createdAt: "asc" },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    res.status(200).json(pendingProgress);
  } catch (error) {
    console.error("[PROGRESS] Get pending error:", error);
    res.status(500).json({ error: "Failed to get pending progress" });
  }
};

export const getUserProgress = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    const progress = await prisma.progressUpdate.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    res.status(200).json(progress);
  } catch (error) {
    console.error("[PROGRESS] Get user progress error:", error);
    res.status(500).json({ error: "Failed to get progress" });
  }
};