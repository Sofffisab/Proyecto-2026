import { prisma } from "../prisma/prisma.js";
import { ERROR_CODES, ROLES, STATUS, validateRole, paginate } from "../shared/utils.js";
import { sendPushAndNotification } from "./notifications.js";

// ============ DASHBOARD ============

export const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalTrainers,
      totalMachines,
      activeCheckIns,
      todayCheckIns,
      pendingHelpRequests,
      pendingProgress,
      pendingRewardClaims,
    ] = await Promise.all([
      prisma.user.count({ where: { role: ROLES.USER } }),
      prisma.user.count({ where: { role: ROLES.TRAINER } }),
      prisma.machine.count(),
      prisma.checkIn.count({ where: { exitTime: null } }),
      prisma.checkIn.count({ where: { entryTime: { gte: today } } }),
      prisma.helpRequest.count({ where: { status: STATUS.PENDING } }),
      prisma.progressUpdate.count({ where: { status: STATUS.PENDING } }),
      prisma.rewardClaim.count({ where: { status: STATUS.PENDING } }),
    ]);

    return res.status(200).json({
      stats: {
        totalUsers,
        totalTrainers,
        totalMachines,
        activeCheckIns,
        todayCheckIns,
        pendingHelpRequests,
        pendingProgress,
        pendingRewardClaims,
      },
    });
  } catch (error) {
    console.error("[ADMIN] Get dashboard stats error:", error);
    return res.status(500).json({
      error: "Failed to get dashboard stats",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ USER MANAGEMENT ============

export const getAllUsers = async (req, res) => {
  const { page = 1, limit = 20, role, search } = req.query;

  try {
    const pagination = paginate(parseInt(page), parseInt(limit));
    const where = {};

    if (role) where.role = role;
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { username: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          username: true,
          role: true,
          photoUrl: true,
          profileComplete: true,
          accountPaused: true,
          lastLogin: true,
          createdAt: true,
          userPoints: {
            select: {
              totalPoints: true,
              currentPoints: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        ...pagination,
      }),
      prisma.user.count({ where }),
    ]);

    return res.status(200).json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[ADMIN] Get all users error:", error);
    return res.status(500).json({
      error: "Failed to get users",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const updateUserRole = async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  if (!validateRole(role)) {
    return res.status(400).json({
      error: "Invalid role",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({
        error: "Cannot change your own role",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        fullName: true,
        username: true,
        role: true,
      },
    });

    await sendPushAndNotification(
      userId,
      "role_changed",
      "Role Updated",
      `Your role has been changed to ${role}.`,
      { newRole: role }
    );

    return res.status(200).json({
      message: "User role updated",
      user: updatedUser,
    });
  } catch (error) {
    console.error("[ADMIN] Update user role error:", error);
    return res.status(500).json({
      error: "Failed to update user role",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const pauseUserAccount = async (req, res) => {
  const { userId } = req.params;
  const { paused } = req.body;

  if (typeof paused !== "boolean") {
    return res.status(400).json({
      error: "Paused status is required",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({
        error: "Cannot pause your own account",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        accountPaused: paused,
        tokenVersion: paused ? { increment: 1 } : undefined,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        username: true,
        accountPaused: true,
      },
    });

    if (paused) {
      await sendPushAndNotification(
        userId,
        "account_paused",
        "Account Paused",
        "Your account has been paused. Contact support for more information.",
        {}
      );
    }

    return res.status(200).json({
      message: `Account ${paused ? "paused" : "unpaused"}`,
      user: updatedUser,
    });
  } catch (error) {
    console.error("[ADMIN] Pause user account error:", error);
    return res.status(500).json({
      error: "Failed to update account status",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ MACHINE MANAGEMENT ============

export const getAllMachines = async (req, res) => {
  const { page = 1, limit = 20, category, status } = req.query;

  try {
    const pagination = paginate(parseInt(page), parseInt(limit));
    const where = {};

    if (category) where.category = category;
    if (status) where.status = status;

    const [machines, total] = await Promise.all([
      prisma.machine.findMany({
        where,
        orderBy: { name: "asc" },
        ...pagination,
      }),
      prisma.machine.count({ where }),
    ]);

    return res.status(200).json({
      machines,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[ADMIN] Get all machines error:", error);
    return res.status(500).json({
      error: "Failed to get machines",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const createMachine = async (req, res) => {
  const { name, description, category, instructions, muscleGroups } = req.body;

  if (!name) {
    return res.status(400).json({
      error: "Machine name is required",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const machine = await prisma.machine.create({
      data: {
        name,
        description,
        category,
        instructions,
        muscleGroups: muscleGroups || [],
      },
    });

    return res.status(201).json({
      message: "Machine created",
      machine,
    });
  } catch (error) {
    console.error("[ADMIN] Create machine error:", error);
    return res.status(500).json({
      error: "Failed to create machine",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const updateMachine = async (req, res) => {
  const { machineId } = req.params;
  const { name, description, category, instructions, muscleGroups, status } = req.body;

  try {
    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
    });

    if (!machine) {
      return res.status(404).json({
        error: "Machine not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (instructions !== undefined) updateData.instructions = instructions;
    if (muscleGroups !== undefined) updateData.muscleGroups = muscleGroups;
    if (status !== undefined) updateData.status = status;

    const updatedMachine = await prisma.machine.update({
      where: { id: machineId },
      data: updateData,
    });

    return res.status(200).json({
      message: "Machine updated",
      machine: updatedMachine,
    });
  } catch (error) {
    console.error("[ADMIN] Update machine error:", error);
    return res.status(500).json({
      error: "Failed to update machine",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const deleteMachine = async (req, res) => {
  const { machineId } = req.params;

  try {
    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
    });

    if (!machine) {
      return res.status(404).json({
        error: "Machine not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    await prisma.machine.delete({
      where: { id: machineId },
    });

    return res.status(200).json({
      message: "Machine deleted",
    });
  } catch (error) {
    console.error("[ADMIN] Delete machine error:", error);
    return res.status(500).json({
      error: "Failed to delete machine",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ REWARD CLAIMS ============

export const getRewardClaims = async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;

  try {
    const pagination = paginate(parseInt(page), parseInt(limit));
    const where = {};

    if (status) where.status = status;

    const [claims, total] = await Promise.all([
      prisma.rewardClaim.findMany({
        where,
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
    console.error("[ADMIN] Get reward claims error:", error);
    return res.status(500).json({
      error: "Failed to get reward claims",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const processRewardClaim = async (req, res) => {
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
    console.error("[ADMIN] Process reward claim error:", error);
    return res.status(500).json({
      error: "Failed to process claim",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ GYM SETTINGS ============

export const getGymSettings = async (req, res) => {
  try {
    let settings = await prisma.gymSettings.findFirst();

    if (!settings) {
      settings = await prisma.gymSettings.create({
        data: {},
      });
    }

    return res.status(200).json({ settings });
  } catch (error) {
    console.error("[ADMIN] Get gym settings error:", error);
    return res.status(500).json({
      error: "Failed to get settings",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const updateGymSettings = async (req, res) => {
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

  try {
    let settings = await prisma.gymSettings.findFirst();

    const updateData = {};
    if (gymName !== undefined) updateData.gymName = gymName;
    if (openTime !== undefined) updateData.openTime = openTime;
    if (closeTime !== undefined) updateData.closeTime = closeTime;
    if (maxCapacity !== undefined) updateData.maxCapacity = maxCapacity;
    if (pointsPerCheckIn !== undefined) updateData.pointsPerCheckIn = pointsPerCheckIn;
    if (pointsPerHelpReceived !== undefined) updateData.pointsPerHelpReceived = pointsPerHelpReceived;
    if (pointsPerProgressVerified !== undefined) updateData.pointsPerProgressVerified = pointsPerProgressVerified;
    if (pointsPerSocialConnection !== undefined) updateData.pointsPerSocialConnection = pointsPerSocialConnection;

    if (!settings) {
      settings = await prisma.gymSettings.create({
        data: updateData,
      });
    } else {
      settings = await prisma.gymSettings.update({
        where: { id: settings.id },
        data: updateData,
      });
    }

    return res.status(200).json({
      message: "Settings updated",
      settings,
    });
  } catch (error) {
    console.error("[ADMIN] Update gym settings error:", error);
    return res.status(500).json({
      error: "Failed to update settings",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ REPORTS ============

export const getReports = async (req, res) => {
  const { page = 1, limit = 20, reportType, archived } = req.query;

  try {
    const pagination = paginate(parseInt(page), parseInt(limit));
    const where = {};

    if (reportType) where.reportType = reportType;
    if (archived !== undefined) where.archived = archived === "true";

    const [reports, total] = await Promise.all([
      prisma.adminReport.findMany({
        where,
        orderBy: { generatedAt: "desc" },
        ...pagination,
      }),
      prisma.adminReport.count({ where }),
    ]);

    return res.status(200).json({
      reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[ADMIN] Get reports error:", error);
    return res.status(500).json({
      error: "Failed to get reports",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const generateReport = async (req, res) => {
  const { reportType } = req.body;

  if (!reportType) {
    return res.status(400).json({
      error: "Report type is required",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    let data = {};

    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    switch (reportType) {
      case "user_activity":
        const [totalUsers, activeUsers, newUsers] = await Promise.all([
          prisma.user.count(),
          prisma.user.count({
            where: { lastLogin: { gte: thirtyDaysAgo } },
          }),
          prisma.user.count({
            where: { createdAt: { gte: thirtyDaysAgo } },
          }),
        ]);
        data = { totalUsers, activeUsers, newUsers, period: "30 days" };
        break;

      case "check_in_stats":
        const [totalCheckIns, uniqueUsers] = await Promise.all([
          prisma.checkIn.count({
            where: { entryTime: { gte: thirtyDaysAgo } },
          }),
          prisma.checkIn.groupBy({
            by: ["userId"],
            where: { entryTime: { gte: thirtyDaysAgo } },
          }),
        ]);
        data = {
          totalCheckIns,
          uniqueUsers: uniqueUsers.length,
          period: "30 days",
        };
        break;

      case "help_requests":
        const helpStats = await prisma.helpRequest.groupBy({
          by: ["status"],
          _count: { id: true },
          where: { createdAt: { gte: thirtyDaysAgo } },
        });
        data = {
          stats: helpStats,
          period: "30 days",
        };
        break;

      case "rewards":
        const rewardStats = await prisma.rewardClaim.groupBy({
          by: ["status"],
          _count: { id: true },
          where: { createdAt: { gte: thirtyDaysAgo } },
        });
        data = {
          stats: rewardStats,
          period: "30 days",
        };
        break;

      default:
        return res.status(400).json({
          error: "Invalid report type",
          code: ERROR_CODES.VALIDATION_ERROR,
        });
    }

    const report = await prisma.adminReport.create({
      data: {
        reportType,
        data,
        generatedAt: new Date(),
      },
    });

    return res.status(201).json({
      message: "Report generated",
      report,
    });
  } catch (error) {
    console.error("[ADMIN] Generate report error:", error);
    return res.status(500).json({
      error: "Failed to generate report",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const archiveReport = async (req, res) => {
  const { reportId } = req.params;

  try {
    const report = await prisma.adminReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return res.status(404).json({
        error: "Report not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    const updatedReport = await prisma.adminReport.update({
      where: { id: reportId },
      data: { archived: true },
    });

    return res.status(200).json({
      message: "Report archived",
      report: updatedReport,
    });
  } catch (error) {
    console.error("[ADMIN] Archive report error:", error);
    return res.status(500).json({
      error: "Failed to archive report",
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
    console.error("[ADMIN] Create reward error:", error);
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
    console.error("[ADMIN] Update reward error:", error);
    return res.status(500).json({
      error: "Failed to update reward",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const deleteReward = async (req, res) => {
  const { rewardId } = req.params;

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

    await prisma.reward.delete({
      where: { id: rewardId },
    });

    return res.status(200).json({
      message: "Reward deleted",
    });
  } catch (error) {
    console.error("[ADMIN] Delete reward error:", error);
    return res.status(500).json({
      error: "Failed to delete reward",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};