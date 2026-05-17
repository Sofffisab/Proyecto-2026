import { prisma } from "../prisma/prisma.js";
import { v4 as uuid } from "uuid";
import { sendPushAndNotification } from "./notifications.js";
import { NOTIFICATION_TYPES, ROLES } from "../shared/utils.js";

// ============ STATISTICS SERVICE ============

export const calculateGymStats = async (startDate, endDate) => {
  const checkIns = await prisma.checkIn.count({
    where: {
      entryTime: { gte: startDate, lte: endDate },
    },
  });

  const newUsers = await prisma.user.count({
    where: {
      createdAt: { gte: startDate, lte: endDate },
    },
  });

  const activeUsers = await prisma.checkIn.groupBy({
    by: ["userId"],
    where: {
      entryTime: { gte: startDate, lte: endDate },
    },
  });

  const helpRequests = await prisma.helpRequest.count({
    where: {
      requestedAt: { gte: startDate, lte: endDate },
    },
  });

  const progressUpdates = await prisma.progressUpdate.count({
    where: {
      createdAt: { gte: startDate, lte: endDate },
    },
  });

  return {
    checkIns,
    newUsers,
    activeUsers: activeUsers.length,
    helpRequests,
    progressUpdates,
    period: { startDate, endDate },
  };
};

export const calculateEmployeeStats = async (trainerId, startDate, endDate) => {
  const helpCompleted = await prisma.helpRequest.count({
    where: {
      claimedBy: trainerId,
      status: "completed",
      completedAt: { gte: startDate, lte: endDate },
    },
  });

  const progressVerified = await prisma.progressUpdate.count({
    where: {
      verifiedBy: trainerId,
      verifiedAt: { gte: startDate, lte: endDate },
    },
  });

  const avgRating = await prisma.helpRequest.aggregate({
    where: {
      claimedBy: trainerId,
      rating: { not: null },
      completedAt: { gte: startDate, lte: endDate },
    },
    _avg: { rating: true },
  });

  return {
    trainerId,
    helpCompleted,
    progressVerified,
    avgRating: avgRating._avg.rating || 0,
    period: { startDate, endDate },
  };
};

export const calculateMachineStats = async (machineId, startDate, endDate) => {
  const usageCount = await prisma.machineUsage.count({
    where: {
      machineId,
      startTime: { gte: startDate, lte: endDate },
    },
  });

  const uniqueUsers = await prisma.machineUsage.groupBy({
    by: ["userId"],
    where: {
      machineId,
      startTime: { gte: startDate, lte: endDate },
    },
  });

  return {
    machineId,
    usageCount,
    uniqueUsers: uniqueUsers.length,
    period: { startDate, endDate },
  };
};

export const generateReport = async (reportType, data) => {
  return await prisma.adminReport.create({
    data: {
      id: uuid(),
      reportType,
      data,
      generatedAt: new Date(),
    },
  });
};

// ============ STATISTICS CONTROLLERS ============

export const getGymStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const stats = await calculateGymStats(start, end);

    res.status(200).json(stats);
  } catch (error) {
    console.error("[ADMIN] Get gym stats error:", error);
    res.status(500).json({ error: "Failed to get gym stats" });
  }
};

export const getEmployeeStats = async (req, res) => {
  try {
    const { trainerId } = req.params;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const stats = await calculateEmployeeStats(trainerId, start, end);

    res.status(200).json(stats);
  } catch (error) {
    console.error("[ADMIN] Get employee stats error:", error);
    res.status(500).json({ error: "Failed to get employee stats" });
  }
};

export const getMachineStats = async (req, res) => {
  try {
    const { machineId } = req.params;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const stats = await calculateMachineStats(machineId, start, end);

    res.status(200).json(stats);
  } catch (error) {
    console.error("[ADMIN] Get machine stats error:", error);
    res.status(500).json({ error: "Failed to get machine stats" });
  }
};

export const getAllMachineStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const machines = await prisma.machine.findMany();
    const stats = [];

    for (const machine of machines) {
      const machineStats = await calculateMachineStats(machine.id, start, end);
      stats.push({ ...machineStats, machineName: machine.name });
    }

    res.status(200).json(stats);
  } catch (error) {
    console.error("[ADMIN] Get all machine stats error:", error);
    res.status(500).json({ error: "Failed to get machine stats" });
  }
};

export const getReports = async (req, res) => {
  try {
    const { limit = 20, offset = 0, reportType } = req.query;

    const reports = await prisma.adminReport.findMany({
      where: {
        ...(reportType && { reportType }),
        archived: false,
      },
      orderBy: { generatedAt: "desc" },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    res.status(200).json(reports);
  } catch (error) {
    console.error("[ADMIN] Get reports error:", error);
    res.status(500).json({ error: "Failed to get reports" });
  }
};

export const generateReportCtrl = async (req, res) => {
  try {
    const { reportType } = req.body;

    if (!reportType) {
      return res.status(400).json({ error: "Report type is required" });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    let data = {};

    switch (reportType) {
      case "gym_summary":
        data = await calculateGymStats(thirtyDaysAgo, now);
        break;
      case "trainers_summary":
        const trainers = await prisma.user.findMany({
          where: { role: ROLES.TRAINER },
        });
        data = {
          trainers: await Promise.all(
            trainers.map((t) => calculateEmployeeStats(t.id, thirtyDaysAgo, now))
          ),
        };
        break;
      case "machines_summary":
        const machines = await prisma.machine.findMany();
        data = {
          machines: await Promise.all(
            machines.map((m) => calculateMachineStats(m.id, thirtyDaysAgo, now))
          ),
        };
        break;
      default:
        return res.status(400).json({ error: "Invalid report type" });
    }

    const report = await generateReport(reportType, data);

    res.status(201).json({
      message: "Report generated successfully",
      report,
    });
  } catch (error) {
    console.error("[ADMIN] Generate report error:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
};

// ============ DASHBOARD CONTROLLER ============

export const getDashboard = async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Today's stats
    const todayCheckIns = await prisma.checkIn.count({
      where: { entryTime: { gte: todayStart } },
    });

    const currentlyCheckedIn = await prisma.checkIn.count({
      where: { exitTime: null },
    });

    // Weekly stats
    const weeklyCheckIns = await prisma.checkIn.count({
      where: { entryTime: { gte: weekAgo } },
    });

    const weeklyNewUsers = await prisma.user.count({
      where: { createdAt: { gte: weekAgo } },
    });

    // Pending items
    const pendingHelp = await prisma.helpRequest.count({
      where: { status: "pending" },
    });

    const pendingProgress = await prisma.progressUpdate.count({
      where: { status: "pending" },
    });

    const pendingClaims = await prisma.rewardClaim.count({
      where: { status: "pending" },
    });

    // Totals
    const totalUsers = await prisma.user.count();
    const totalMachines = await prisma.machine.count();

    res.status(200).json({
      today: {
        checkIns: todayCheckIns,
        currentlyIn: currentlyCheckedIn,
      },
      weekly: {
        checkIns: weeklyCheckIns,
        newUsers: weeklyNewUsers,
      },
      pending: {
        helpRequests: pendingHelp,
        progressUpdates: pendingProgress,
        rewardClaims: pendingClaims,
      },
      totals: {
        users: totalUsers,
        machines: totalMachines,
      },
    });
  } catch (error) {
    console.error("[ADMIN] Get dashboard error:", error);
    res.status(500).json({ error: "Failed to get dashboard" });
  }
};

// ============ USER MANAGEMENT CONTROLLERS ============

export const getAllUsers = async (req, res) => {
  try {
    const { limit = 20, offset = 0, role, search } = req.query;

    const users = await prisma.user.findMany({
      where: {
        ...(role && { role }),
        ...(search && {
          OR: [
            { fullName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { username: { contains: search, mode: "insensitive" } },
          ],
        }),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        username: true,
        role: true,
        profileComplete: true,
        accountPaused: true,
        createdAt: true,
        lastLogin: true,
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    const total = await prisma.user.count({
      where: {
        ...(role && { role }),
        ...(search && {
          OR: [
            { fullName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { username: { contains: search, mode: "insensitive" } },
          ],
        }),
      },
    });

    res.status(200).json({ users, total });
  } catch (error) {
    console.error("[ADMIN] Get all users error:", error);
    res.status(500).json({ error: "Failed to get users" });
  }
};

export const setUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    await sendPushAndNotification(
      userId,
      NOTIFICATION_TYPES.ROLE_CHANGED,
      "Role Updated",
      `Your role has been changed to ${role}`,
      { newRole: role }
    );

    res.status(200).json({
      message: "User role updated successfully",
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[ADMIN] Set user role error:", error);
    res.status(500).json({ error: "Failed to update user role" });
  }
};

export const getTrainers = async (req, res) => {
  try {
    const trainers = await prisma.user.findMany({
      where: { role: ROLES.TRAINER },
      select: {
        id: true,
        email: true,
        fullName: true,
        username: true,
        photo: true,
        createdAt: true,
      },
    });

    res.status(200).json(trainers);
  } catch (error) {
    console.error("[ADMIN] Get trainers error:", error);
    res.status(500).json({ error: "Failed to get trainers" });
  }
};

// ============ GYM SETTINGS CONTROLLERS ============

export const getGymSettings = async (req, res) => {
  try {
    let settings = await prisma.gymSettings.findFirst();

    if (!settings) {
      settings = await prisma.gymSettings.create({
        data: {
          id: uuid(),
          gymName: "My Gym",
          openTime: "06:00",
          closeTime: "22:00",
          maxCapacity: 100,
          pointsPerCheckIn: 10,
          pointsPerHelpReceived: 50,
          pointsPerProgressVerified: 100,
          pointsPerSocialConnection: 25,
        },
      });
    }

    res.status(200).json(settings);
  } catch (error) {
    console.error("[ADMIN] Get gym settings error:", error);
    res.status(500).json({ error: "Failed to get gym settings" });
  }
};

export const updateGymSettings = async (req, res) => {
  try {
    const {
      gymName,
      openTime,
      closeTime,
      maxCapacity,
      pointsPerCheckIn,
      pointsPerHelpReceived,
      pointsPerProgressVerified,
      pointsPerSocialConnection,
    } = req.body;

    let settings = await prisma.gymSettings.findFirst();

    if (!settings) {
      settings = await prisma.gymSettings.create({
        data: {
          id: uuid(),
          gymName: gymName || "My Gym",
          openTime: openTime || "06:00",
          closeTime: closeTime || "22:00",
          maxCapacity: maxCapacity || 100,
          pointsPerCheckIn: pointsPerCheckIn || 10,
          pointsPerHelpReceived: pointsPerHelpReceived || 50,
          pointsPerProgressVerified: pointsPerProgressVerified || 100,
          pointsPerSocialConnection: pointsPerSocialConnection || 25,
        },
      });
    } else {
      settings = await prisma.gymSettings.update({
        where: { id: settings.id },
        data: {
          ...(gymName && { gymName }),
          ...(openTime && { openTime }),
          ...(closeTime && { closeTime }),
          ...(maxCapacity && { maxCapacity }),
          ...(pointsPerCheckIn && { pointsPerCheckIn }),
          ...(pointsPerHelpReceived && { pointsPerHelpReceived }),
          ...(pointsPerProgressVerified && { pointsPerProgressVerified }),
          ...(pointsPerSocialConnection && { pointsPerSocialConnection }),
        },
      });
    }

    res.status(200).json({
      message: "Gym settings updated successfully",
      settings,
    });
  } catch (error) {
    console.error("[ADMIN] Update gym settings error:", error);
    res.status(500).json({ error: "Failed to update gym settings" });
  }
};

// ============ MACHINES CONTROLLERS ============

export const getMachines = async (req, res) => {
  try {
    const { limit = 50, offset = 0, category } = req.query;

    const machines = await prisma.machine.findMany({
      where: {
        ...(category && { category }),
      },
      orderBy: { name: "asc" },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    res.status(200).json(machines);
  } catch (error) {
    console.error("[MACHINES] Get machines error:", error);
    res.status(500).json({ error: "Failed to get machines" });
  }
};

export const getMachine = async (req, res) => {
  try {
    const { machineId } = req.params;

    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
    });

    if (!machine) {
      return res.status(404).json({ error: "Machine not found" });
    }

    res.status(200).json(machine);
  } catch (error) {
    console.error("[MACHINES] Get machine error:", error);
    res.status(500).json({ error: "Failed to get machine" });
  }
};

export const createMachine = async (req, res) => {
  try {
    const { name, description, category, instructions, muscleGroups } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Machine name is required" });
    }

    const machine = await prisma.machine.create({
      data: {
        id: uuid(),
        name,
        description,
        category,
        instructions,
        muscleGroups: muscleGroups || [],
        status: "available",
      },
    });

    res.status(201).json({
      message: "Machine created successfully",
      machine,
    });
  } catch (error) {
    console.error("[MACHINES] Create machine error:", error);
    res.status(500).json({ error: "Failed to create machine" });
  }
};

export const updateMachine = async (req, res) => {
  try {
    const { machineId } = req.params;
    const { name, description, category, instructions, muscleGroups, status } = req.body;

    const machine = await prisma.machine.update({
      where: { id: machineId },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(category && { category }),
        ...(instructions && { instructions }),
        ...(muscleGroups && { muscleGroups }),
        ...(status && { status }),
      },
    });

    res.status(200).json({
      message: "Machine updated successfully",
      machine,
    });
  } catch (error) {
    console.error("[MACHINES] Update machine error:", error);
    res.status(500).json({ error: "Failed to update machine" });
  }
};

export const deleteMachine = async (req, res) => {
  try {
    const { machineId } = req.params;

    await prisma.machine.delete({
      where: { id: machineId },
    });

    res.status(200).json({ message: "Machine deleted successfully" });
  } catch (error) {
    console.error("[MACHINES] Delete machine error:", error);
    res.status(500).json({ error: "Failed to delete machine" });
  }
};

// ============ REVIEWS CONTROLLERS ============

export const createReview = async (req, res) => {
  try {
    const { machineId, trainerId, rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    if (!machineId && !trainerId) {
      return res.status(400).json({ error: "Machine ID or Trainer ID is required" });
    }

    const review = await prisma.review.create({
      data: {
        id: uuid(),
        userId: req.userId,
        machineId: machineId || null,
        trainerId: trainerId || null,
        rating,
        comment,
      },
    });

    res.status(201).json({
      message: "Review created successfully",
      review,
    });
  } catch (error) {
    console.error("[REVIEWS] Create review error:", error);
    res.status(500).json({ error: "Failed to create review" });
  }
};

export const getMachineReviews = async (req, res) => {
  try {
    const { machineId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const reviews = await prisma.review.findMany({
      where: { machineId },
      include: {
        user: {
          select: { id: true, fullName: true, username: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    res.status(200).json(reviews);
  } catch (error) {
    console.error("[REVIEWS] Get machine reviews error:", error);
    res.status(500).json({ error: "Failed to get reviews" });
  }
};

export const getTrainerReviews = async (req, res) => {
  try {
    const { trainerId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const reviews = await prisma.review.findMany({
      where: { trainerId },
      include: {
        user: {
          select: { id: true, fullName: true, username: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    res.status(200).json(reviews);
  } catch (error) {
    console.error("[REVIEWS] Get trainer reviews error:", error);
    res.status(500).json({ error: "Failed to get reviews" });
  }
};

export const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    if (review.userId !== req.userId && req.userRole !== ROLES.ADMIN) {
      return res.status(403).json({ error: "Not authorized to delete this review" });
    }

    await prisma.review.delete({
      where: { id: reviewId },
    });

    res.status(200).json({ message: "Review deleted successfully" });
  } catch (error) {
    console.error("[REVIEWS] Delete review error:", error);
    res.status(500).json({ error: "Failed to delete review" });
  }
};

// ============ ROUTINES CONTROLLERS ============

export const getRoutines = async (req, res) => {
  try {
    const { userId } = req.params;

    const routines = await prisma.userRoutine.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(routines);
  } catch (error) {
    console.error("[ROUTINES] Get routines error:", error);
    res.status(500).json({ error: "Failed to get routines" });
  }
};

export const createRoutine = async (req, res) => {
  try {
    const { name, description, exercises, daysOfWeek, reminderTime, remindersEnabled } = req.body;

    if (!name || !exercises || exercises.length === 0) {
      return res.status(400).json({ error: "Name and exercises are required" });
    }

    const routine = await prisma.userRoutine.create({
      data: {
        id: uuid(),
        userId: req.userId,
        name,
        description,
        exercises,
        daysOfWeek: daysOfWeek || [],
        reminderTime: reminderTime || null,
        remindersEnabled: remindersEnabled || false,
      },
    });

    res.status(201).json({
      message: "Routine created successfully",
      routine,
    });
  } catch (error) {
    console.error("[ROUTINES] Create routine error:", error);
    res.status(500).json({ error: "Failed to create routine" });
  }
};

export const updateRoutine = async (req, res) => {
  try {
    const { routineId } = req.params;
    const { name, description, exercises, daysOfWeek, reminderTime, remindersEnabled } = req.body;

    const existing = await prisma.userRoutine.findUnique({
      where: { id: routineId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Routine not found" });
    }

    if (existing.userId !== req.userId) {
      return res.status(403).json({ error: "Not authorized to update this routine" });
    }

    const routine = await prisma.userRoutine.update({
      where: { id: routineId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(exercises && { exercises }),
        ...(daysOfWeek && { daysOfWeek }),
        ...(reminderTime !== undefined && { reminderTime }),
        ...(remindersEnabled !== undefined && { remindersEnabled }),
      },
    });

    res.status(200).json({
      message: "Routine updated successfully",
      routine,
    });
  } catch (error) {
    console.error("[ROUTINES] Update routine error:", error);
    res.status(500).json({ error: "Failed to update routine" });
  }
};

export const deleteRoutine = async (req, res) => {
  try {
    const { routineId } = req.params;

    const existing = await prisma.userRoutine.findUnique({
      where: { id: routineId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Routine not found" });
    }

    if (existing.userId !== req.userId && req.userRole !== ROLES.ADMIN) {
      return res.status(403).json({ error: "Not authorized to delete this routine" });
    }

    await prisma.userRoutine.delete({
      where: { id: routineId },
    });

    res.status(200).json({ message: "Routine deleted successfully" });
  } catch (error) {
    console.error("[ROUTINES] Delete routine error:", error);
    res.status(500).json({ error: "Failed to delete routine" });
  }
};