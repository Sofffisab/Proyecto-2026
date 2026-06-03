import { prisma } from "../prisma/prisma.js";
import { ERROR_CODES, STATUS } from "../shared/utils.js";

export const getLastInteraction = async (req, res) => {
  const { trainerId, userId } = req.params;
  try {
    const lastHelp = await prisma.helpRequest.findFirst({
      where: {
        userId,
        claimedBy: trainerId,
        status: STATUS.COMPLETED,
      },
      orderBy: { completedAt: "desc" },
    });
    if (!lastHelp) {
      return res.status(200).json({
        lastInteraction: null,
        message: "Never helped this user",
      });
    }
    return res.status(200).json({
      lastInteraction: lastHelp.completedAt,
      helpId: lastHelp.id,
    });
  } catch (error) {
    console.error("[TRAINERS] Get last interaction error:", error);
    return res.status(500).json({
      error: "Failed to get last interaction",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const getActiveUsersForTrainer = async (req, res) => {
  try {
    const activeCheckIns = await prisma.checkIn.findMany({
      where: { exitTime: null },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            photoUrl: true,
            profile: {
              select: {
                age: true,
                fitnessLevel: true,
                goals: true,
                injuries: true,
              },
            },
          },
        },
      },
    });
    // Obtener solicitudes de ayuda pendientes
    const pendingHelp = await prisma.helpRequest.findMany({
      where: { status: STATUS.PENDING },
      select: { userId: true },
    });
    const usersNeedingHelp = new Set(pendingHelp.map((h) => h.userId));
    const users = activeCheckIns.map((ci) => ({
      ...ci.user,
      checkedInAt: ci.entryTime,
      needsHelp: usersNeedingHelp.has(ci.user.id),
    }));
    return res.status(200).json({ users });
  } catch (error) {
    console.error("[GYM] Get active users error:", error);
    return res.status(500).json({
      error: "Failed to get active users",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};