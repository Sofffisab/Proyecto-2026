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
      const sanitizedSearch = search.trim().slice(0, 100).replace(/[^a-zA-Z0-9@._-]/g, '');
      if (sanitizedSearch.length > 0) {

      where.OR = [
        { fullName: { contains: sanitizedSearch, mode: "insensitive" } },
        { username: { contains: sanitizedSearch, mode: "insensitive" } },
        { email: { contains: sanitizedSearch, mode: "insensitive" } },
      ];
  }
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

// ============ ALIASES ============

export const getDashboard = getDashboardStats;
export const setUserRole = updateUserRole;
export const generateReportCtrl = generateReport;
export const getMachines = getAllMachines;
export const getMachine = async (req, res) => {
  const { machineId } = req.params;

  try {
    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
      include: {
        reviews: {
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
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!machine) {
      return res.status(404).json({
        error: "Machine not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    return res.status(200).json({ machine });
  } catch (error) {
    console.error("[ADMIN] Get machine error:", error);
    return res.status(500).json({
      error: "Failed to get machine",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ TRAINERS ============

export const getTrainers = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  try {
    const pagination = paginate(parseInt(page), parseInt(limit));

    const [trainers, total] = await Promise.all([
      prisma.user.findMany({
        where: { role: ROLES.TRAINER },
        select: {
          id: true,
          email: true,
          fullName: true,
          username: true,
          photoUrl: true,
          lastLogin: true,
          createdAt: true,
        },
        orderBy: { fullName: "asc" },
        ...pagination,
      }),
      prisma.user.count({ where: { role: ROLES.TRAINER } }),
    ]);

    return res.status(200).json({
      trainers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[ADMIN] Get trainers error:", error);
    return res.status(500).json({
      error: "Failed to get trainers",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ STATISTICS ============

export const getGymStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeUsers,
      totalCheckIns,
      todayCheckIns,
      currentOccupancy,
      totalMachines,
      machinesInUse,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.checkIn.count({ where: { exitTime: null } }),
      prisma.checkIn.count(),
      prisma.checkIn.count({ where: { entryTime: { gte: today } } }),
      prisma.checkIn.count({ where: { exitTime: null } }),
      prisma.machine.count(),
      prisma.machine.count({ where: { status: "in_use" } }),
    ]);

    return res.status(200).json({
      stats: {
        totalUsers,
        activeUsers,
        totalCheckIns,
        todayCheckIns,
        currentOccupancy,
        totalMachines,
        machinesInUse,
      },
    });
  } catch (error) {
    console.error("[ADMIN] Get gym stats error:", error);
    return res.status(500).json({
      error: "Failed to get gym stats",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const getEmployeeStats = async (req, res) => {
  const { trainerId } = req.params;

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [helpRequests, progressVerified, avgRating] = await Promise.all([
      prisma.helpRequest.count({
        where: {
          claimedBy: trainerId,
          status: STATUS.COMPLETED,
          completedAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.progressUpdate.count({
        where: {
          verifiedBy: trainerId,
          status: STATUS.APPROVED,
          verifiedAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.helpRequest.aggregate({
        where: {
          claimedBy: trainerId,
          rating: { not: null },
        },
        _avg: { rating: true },
      }),
    ]);

    return res.status(200).json({
      stats: {
        period: "30 days",
        helpRequestsCompleted: helpRequests,
        progressVerified,
        averageRating: avgRating._avg.rating || 0,
      },
    });
  } catch (error) {
    console.error("[ADMIN] Get employee stats error:", error);
    return res.status(500).json({
      error: "Failed to get employee stats",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const getMachineStats = async (req, res) => {
  const { machineId } = req.params;

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalUsages, uniqueUsers, avgDuration] = await Promise.all([
      prisma.machineUsage.count({
        where: {
          machineId,
          startTime: { gte: thirtyDaysAgo },
        },
      }),
      prisma.machineUsage.groupBy({
        by: ["userId"],
        where: {
          machineId,
          startTime: { gte: thirtyDaysAgo },
        },
      }),
      prisma.machineUsage.findMany({
        where: {
          machineId,
          endTime: { not: null },
          startTime: { gte: thirtyDaysAgo },
        },
        select: { startTime: true, endTime: true },
      }),
    ]);

    const avgDurationMinutes =
      avgDuration.length > 0
        ? avgDuration.reduce((sum, u) => {
            return sum + (new Date(u.endTime) - new Date(u.startTime)) / 1000 / 60;
          }, 0) / avgDuration.length
        : 0;

    return res.status(200).json({
      stats: {
        period: "30 days",
        totalUsages,
        uniqueUsers: uniqueUsers.length,
        averageDurationMinutes: Math.round(avgDurationMinutes),
      },
    });
  } catch (error) {
    console.error("[ADMIN] Get machine stats error:", error);
    return res.status(500).json({
      error: "Failed to get machine stats",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const getAllMachineStats = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const machineUsageStats = await prisma.machineUsage.groupBy({
      by: ["machineId"],
      where: { startTime: { gte: thirtyDaysAgo } },
      _count: { id: true },
    });

    const machines = await prisma.machine.findMany({
      select: { id: true, name: true, category: true, status: true },
    });

    const statsWithNames = machines.map((m) => {
      const usage = machineUsageStats.find((u) => u.machineId === m.id);
      return {
        ...m,
        usageCount: usage?._count?.id || 0,
      };
    });

    return res.status(200).json({
      stats: statsWithNames.sort((a, b) => b.usageCount - a.usageCount),
    });
  } catch (error) {
    console.error("[ADMIN] Get all machine stats error:", error);
    return res.status(500).json({
      error: "Failed to get machine stats",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ ROUTINES (desde users.js pero en admin) ============

export const getRoutines = async (req, res) => {
  const { userId } = req.params;

  try {
    const routines = await prisma.userRoutine.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ routines });
  } catch (error) {
    console.error("[ADMIN] Get routines error:", error);
    return res.status(500).json({
      error: "Failed to get routines",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const createRoutine = async (req, res) => {
  const { name, description, exercises, daysOfWeek, reminderTime, remindersEnabled } = req.body;
  const userId = req.body.userId || req.user.id;

  if (!name) {
    return res.status(400).json({
      error: "Routine name is required",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const routine = await prisma.userRoutine.create({
      data: {
        userId,
        name,
        description,
        exercises: exercises || [],
        daysOfWeek: daysOfWeek || [],
        reminderTime,
        remindersEnabled: remindersEnabled || false,
      },
    });

    return res.status(201).json({
      message: "Routine created",
      routine,
    });
  } catch (error) {
    console.error("[ADMIN] Create routine error:", error);
    return res.status(500).json({
      error: "Failed to create routine",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const updateRoutine = async (req, res) => {
  const { routineId } = req.params;
  const { name, description, exercises, daysOfWeek, reminderTime, remindersEnabled } = req.body;

  try {
    const routine = await prisma.userRoutine.findUnique({
      where: { id: routineId },
    });

    if (!routine) {
      return res.status(404).json({
        error: "Routine not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    // Check ownership unless admin
    if (routine.userId !== req.user.id && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({
        error: "Access denied",
        code: ERROR_CODES.FORBIDDEN,
      });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (exercises !== undefined) updateData.exercises = exercises;
    if (daysOfWeek !== undefined) updateData.daysOfWeek = daysOfWeek;
    if (reminderTime !== undefined) updateData.reminderTime = reminderTime;
    if (remindersEnabled !== undefined) updateData.remindersEnabled = remindersEnabled;

    const updatedRoutine = await prisma.userRoutine.update({
      where: { id: routineId },
      data: updateData,
    });

    return res.status(200).json({
      message: "Routine updated",
      routine: updatedRoutine,
    });
  } catch (error) {
    console.error("[ADMIN] Update routine error:", error);
    return res.status(500).json({
      error: "Failed to update routine",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const deleteRoutine = async (req, res) => {
  const { routineId } = req.params;

  try {
    const routine = await prisma.userRoutine.findUnique({
      where: { id: routineId },
    });

    if (!routine) {
      return res.status(404).json({
        error: "Routine not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    // Check ownership unless admin
    if (routine.userId !== req.user.id && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({
        error: "Access denied",
        code: ERROR_CODES.FORBIDDEN,
      });
    }

    await prisma.userRoutine.delete({
      where: { id: routineId },
    });

    return res.status(200).json({
      message: "Routine deleted",
    });
  } catch (error) {
    console.error("[ADMIN] Delete routine error:", error);
    return res.status(500).json({
      error: "Failed to delete routine",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ REVIEWS ============

export const createReview = async (req, res) => {
  const { machineId, trainerId, rating, comment } = req.body;

  if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({
      error: "Rating must be an integer between 1 and 5",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  if (!machineId && !trainerId) {
    return res.status(400).json({
      error: "Either machineId or trainerId is required",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const review = await prisma.review.create({
      data: {
        userId: req.user.id,
        machineId,
        trainerId,
        rating,
        comment,
      },
    });

    return res.status(201).json({
      message: "Review created",
      review,
    });
  } catch (error) {
    console.error("[ADMIN] Create review error:", error);
    return res.status(500).json({
      error: "Failed to create review",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const getMachineReviews = async (req, res) => {
  const { machineId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  try {
    const pagination = paginate(parseInt(page), parseInt(limit));

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { machineId },
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
        orderBy: { createdAt: "desc" },
        ...pagination,
      }),
      prisma.review.count({ where: { machineId } }),
    ]);

    return res.status(200).json({
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[ADMIN] Get machine reviews error:", error);
    return res.status(500).json({
      error: "Failed to get reviews",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const getTrainerReviews = async (req, res) => {
  const { trainerId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  try {
    const pagination = paginate(parseInt(page), parseInt(limit));

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { trainerId },
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
        orderBy: { createdAt: "desc" },
        ...pagination,
      }),
      prisma.review.count({ where: { trainerId } }),
    ]);

    return res.status(200).json({
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[ADMIN] Get trainer reviews error:", error);
    return res.status(500).json({
      error: "Failed to get reviews",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const deleteReview = async (req, res) => {
  const { reviewId } = req.params;

  try {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      return res.status(404).json({
        error: "Review not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    // Check ownership unless admin
    if (review.userId !== req.user.id && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({
        error: "Access denied",
        code: ERROR_CODES.FORBIDDEN,
      });
    }

    await prisma.review.delete({
      where: { id: reviewId },
    });

    return res.status(200).json({
      message: "Review deleted",
    });
  } catch (error) {
    console.error("[ADMIN] Delete review error:", error);
    return res.status(500).json({
      error: "Failed to delete review",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};


// ============ STATISTICS ============

export const getEmployeeStats = async (req, res) => {
  const { trainerId } = req.params;
  try {
    const [helpRequests, completedHelp, avgRating] = await Promise.all([
      prisma.helpRequest.count({ where: { trainerId, status: STATUS.COMPLETED } }),
      prisma.helpRequest.count({ where: { trainerId, status: STATUS.COMPLETED } }),
      prisma.helpRequest.aggregate({
        where: { trainerId, status: STATUS.COMPLETED },
        _avg: { rating: true }
      })
    ]);
    return res.status(200).json({
      stats: { helpRequests, completedHelp, avgRating: avgRating._avg.rating || 0 }
    });
  } catch (error) {
    console.error("[ADMIN] Get employee stats error:", error);
    return res.status(500).json({
      error: "Failed to get employee stats",
      code: ERROR_CODES.INTERNAL_ERROR
    });
  }
};

export const getMachineStats = async (req, res) => {
  const { machineId } = req.params;
  try {
    const [uses, avgRating] = await Promise.all([
      prisma.machineUsage.count({ where: { machineId } }),
      prisma.review.aggregate({
        where: { machineId },
        _avg: { rating: true }
      })
    ]);
    return res.status(200).json({
      stats: { uses, avgRating: avgRating._avg.rating || 0 }
    });
  } catch (error) {
    console.error("[ADMIN] Get machine stats error:", error);
    return res.status(500).json({
      error: "Failed to get machine stats",
      code: ERROR_CODES.INTERNAL_ERROR
    });
  }
};

// ============ MACHINES ============

export const getMachine = async (req, res) => {
  const { machineId } = req.params;
  try {
    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
      include: { reviews: true }
    });
    if (!machine) {
      return res.status(404).json({
        error: "Machine not found",
        code: ERROR_CODES.NOT_FOUND
      });
    }
    return res.status(200).json({ machine });
  } catch (error) {
    console.error("[ADMIN] Get machine error:", error);
    return res.status(500).json({
      error: "Failed to get machine",
      code: ERROR_CODES.INTERNAL_ERROR
    });
  }
};

// ============ REVIEWS ============

export const createReview = async (req, res) => {
  const { machineId, trainerId, rating, comment } = req.body;
  if (!rating || (!machineId && !trainerId)) {
    return res.status(400).json({
      error: "Rating and target are required",
      code: ERROR_CODES.VALIDATION_ERROR
    });
  }
  try {
    const review = await prisma.review.create({
      data: {
        userId: req.user.id,
        machineId: machineId || null,
        trainerId: trainerId || null,
        rating,
        comment
      }
    });
    return res.status(201).json({ message: "Review created", review });
  } catch (error) {
    console.error("[ADMIN] Create review error:", error);
    return res.status(500).json({
      error: "Failed to create review",
      code: ERROR_CODES.INTERNAL_ERROR
    });
  }
};

export const getMachineReviews = async (req, res) => {
  const { machineId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  try {
    const pagination = paginate(parseInt(page), parseInt(limit));
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { machineId },
        include: { user: { select: { id: true, fullName: true, photoUrl: true } } },
        orderBy: { createdAt: "desc" },
        ...pagination
      }),
      prisma.review.count({ where: { machineId } })
    ]);
    return res.status(200).json({
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("[ADMIN] Get machine reviews error:", error);
    return res.status(500).json({
      error: "Failed to get reviews",
      code: ERROR_CODES.INTERNAL_ERROR
    });
  }
};

export const getTrainerReviews = async (req, res) => {
  const { trainerId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  try {
    const pagination = paginate(parseInt(page), parseInt(limit));
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { trainerId },
        include: { user: { select: { id: true, fullName: true, photoUrl: true } } },
        orderBy: { createdAt: "desc" },
        ...pagination
      }),
      prisma.review.count({ where: { trainerId } })
    ]);
    return res.status(200).json({
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("[ADMIN] Get trainer reviews error:", error);
    return res.status(500).json({
      error: "Failed to get reviews",
      code: ERROR_CODES.INTERNAL_ERROR
    });
  }
};

export const deleteReview = async (req, res) => {
  const { reviewId } = req.params;
  try {
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      return res.status(404).json({
        error: "Review not found",
        code: ERROR_CODES.NOT_FOUND
      });
    }
    await prisma.review.delete({ where: { id: reviewId } });
    return res.status(200).json({ message: "Review deleted" });
  } catch (error) {
    console.error("[ADMIN] Delete review error:", error);
    return res.status(500).json({
      error: "Failed to delete review",
      code: ERROR_CODES.INTERNAL_ERROR
    });
  }
};

// ============ TRAINERS ============

export const getTrainers = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  try {
    const pagination = paginate(parseInt(page), parseInt(limit));
    const [trainers, total] = await Promise.all([
      prisma.user.findMany({
        where: { role: ROLES.TRAINER },
        select: {
          id: true,
          fullName: true,
          email: true,
          username: true,
          photoUrl: true,
          createdAt: true
        },
        orderBy: { createdAt: "desc" },
        ...pagination
      }),
      prisma.user.count({ where: { role: ROLES.TRAINER } })
    ]);
    return res.status(200).json({
      trainers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("[ADMIN] Get trainers error:", error);
    return res.status(500).json({
      error: "Failed to get trainers",
      code: ERROR_CODES.INTERNAL_ERROR
    });
  }
};

export async function getEmployeeStats(req, res) {
  try {
    const { employeeId } = req.params;
    
    const trainer = await db.trainer.findUnique({
      where: { id: employeeId },
      include: {
        reviews: true,
        clients: {
          include: {
            _count: { select: { checkIns: true } }
          }
        }
      }
    });

    if (!trainer) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Trainer not found'
      });
    }

    const avgRating = trainer.reviews.length > 0
      ? (trainer.reviews.reduce((sum, r) => sum + r.rating, 0) / trainer.reviews.length).toFixed(2)
      : 0;

    res.status(200).json({
      trainerId: trainer.id,
      name: trainer.name,
      email: trainer.email,
      totalClients: trainer.clients.length,
      averageRating: parseFloat(avgRating),
      totalReviews: trainer.reviews.length,
      clientWorkoutStats: trainer.clients.map(client => ({
        clientId: client.id,
        clientName: client.firstName,
        totalWorkouts: client._count?.checkIns || 0
      }))
    });

  } catch (error) {
    console.error('[admin.getEmployeeStats]', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to fetch employee stats'
    });
  }
}

export async function getMachineStats(req, res) {
  try {
    const { machineId } = req.params;

    const machine = await db.machine.findUnique({
      where: { id: machineId },
      include: {
        reviews: true,
        checkIns: {
          select: {
            caloriesBurned: true,
            duration: true
          }
        }
      }
    });

    if (!machine) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Machine not found'
      });
    }

    const avgRating = machine.reviews.length > 0
      ? (machine.reviews.reduce((sum, r) => sum + r.rating, 0) / machine.reviews.length).toFixed(2)
      : 0;

    const totalCalories = machine.checkIns.reduce((sum, c) => sum + (c.caloriesBurned || 0), 0);
    const avgDuration = machine.checkIns.length > 0
      ? Math.round(machine.checkIns.reduce((sum, c) => sum + c.duration, 0) / machine.checkIns.length)
      : 0;

    res.status(200).json({
      machineId: machine.id,
      name: machine.name,
      status: machine.status,
      totalUsages: machine.checkIns.length,
      averageRating: parseFloat(avgRating),
      totalReviews: machine.reviews.length,
      totalCaloriesBurned: totalCalories,
      averageDurationMinutes: avgDuration
    });

  } catch (error) {
    console.error('[admin.getMachineStats]', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to fetch machine stats'
    });
  }
}

export async function getTrainerReviews(req, res) {
  try {
    const { trainerId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const reviews = await db.review.findMany({
      where: {
        targetType: 'TRAINER',
        targetId: trainerId
      },
      include: {
        reviewer: {
          select: { id: true, firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    const total = await db.review.count({
      where: { targetType: 'TRAINER', targetId: trainerId }
    });

    res.status(200).json({
      reviews,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('[admin.getTrainerReviews]', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to fetch trainer reviews'
    });
  }
}

export async function getMachineReviews(req, res) {
  try {
    const { machineId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const reviews = await db.review.findMany({
      where: {
        targetType: 'MACHINE',
        targetId: machineId
      },
      include: {
        reviewer: {
          select: { id: true, firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    const total = await db.review.count({
      where: { targetType: 'MACHINE', targetId: machineId }
    });

    res.status(200).json({
      reviews,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('[admin.getMachineReviews]', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to fetch machine reviews'
    });
  }
}

export async function createReview(req, res) {
  try {
    const { userId } = req.user;
    const { targetId, targetType, rating, comment } = req.body;

    if (!targetId || !targetType || !rating) {
      return res.status(400).json({
        error: 'invalid_input',
        message: 'targetId, targetType, and rating are required'
      });
    }

    if (![1, 2, 3, 4, 5].includes(rating)) {
      return res.status(400).json({
        error: 'invalid_input',
        message: 'rating must be between 1 and 5'
      });
    }

    const existingReview = await db.review.findFirst({
      where: {
        reviewerId: userId,
        targetId,
        targetType
      }
    });

    if (existingReview) {
      return res.status(409).json({
        error: 'conflict',
        message: 'You have already reviewed this'
      });
    }

    const review = await db.review.create({
      data: {
        reviewerId: userId,
        targetId,
        targetType,
        rating,
        comment
      },
      include: {
        reviewer: {
          select: { id: true, firstName: true }
        }
      }
    });

    res.status(201).json(review);

  } catch (error) {
    console.error('[admin.createReview]', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to create review'
    });
  }
}

export async function deleteReview(req, res) {
  try {
    const { userId } = req.user;
    const { reviewId } = req.params;

    const review = await db.review.findUnique({
      where: { id: reviewId }
    });

    if (!review) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Review not found'
      });
    }

    if (review.reviewerId !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'forbidden',
        message: 'You cannot delete this review'
      });
    }

    await db.review.delete({
      where: { id: reviewId }
    });

    res.status(204).send();

  } catch (error) {
    console.error('[admin.deleteReview]', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to delete review'
    });
  }
}

export async function getTrainerStats(req, res) {
  try {
    const { trainerId } = req.params;

    const trainer = await db.trainer.findUnique({
      where: { id: trainerId },
      include: {
        reviews: true,
        sessions: {
          select: { duration: true }
        }
      }
    });

    if (!trainer) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Trainer not found'
      });
    }

    const avgRating = trainer.reviews.length > 0
      ? (trainer.reviews.reduce((sum, r) => sum + r.rating, 0) / trainer.reviews.length).toFixed(2)
      : 0;

    const totalSessionTime = trainer.sessions.reduce((sum, s) => sum + s.duration, 0);

    res.status(200).json({
      trainerId: trainer.id,
      name: trainer.name,
      averageRating: parseFloat(avgRating),
      totalReviews: trainer.reviews.length,
      totalSessions: trainer.sessions.length,
      totalSessionHours: Math.round(totalSessionTime / 60)
    });

  } catch (error) {
    console.error('[admin.getTrainerStats]', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to fetch trainer stats'
    });
  }
}

// ============ STATISTICS ============

export const getEmployeeStats = async (req, res) => {
  try {
    const { trainerId } = req.params;

    const trainer = await prisma.user.findUnique({
      where: { id: trainerId, role: ROLES.TRAINER },
      include: {
        clients: {
          select: {
            id: true,
            fullName: true,
            checkIns: { select: { id: true } },
          },
        },
      },
    });

    if (!trainer) {
      return res.status(404).json({
        error: "Trainer not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    const totalClients = trainer.clients.length;
    const totalSessions = trainer.clients.reduce((sum, client) => 
      sum + client.checkIns.length, 0
    );

    return res.status(200).json({
      trainerId: trainer.id,
      name: trainer.fullName,
      totalClients,
      totalSessions,
      averageClientsPerSession: Math.round(totalSessions / (totalClients || 1)),
    });

  } catch (error) {
    console.error("[ADMIN] Get employee stats error:", error);
    return res.status(500).json({
      error: "Failed to get employee statistics",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const getMachineStats = async (req, res) => {
  try {
    const { machineId } = req.params;

    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
      include: {
        checkIns: {
          select: {
            id: true,
            caloriesBurned: true,
            duration: true,
          },
        },
      },
    });

    if (!machine) {
      return res.status(404).json({
        error: "Machine not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    const totalUses = machine.checkIns.length;
    const totalCalories = machine.checkIns.reduce((sum, c) => 
      sum + (c.caloriesBurned || 0), 0
    );
    const avgDuration = totalUses > 0
      ? Math.round(machine.checkIns.reduce((sum, c) => sum + c.duration, 0) / totalUses)
      : 0;

    return res.status(200).json({
      machineId: machine.id,
      name: machine.name,
      totalUses,
      totalCalories,
      averageDurationMinutes: avgDuration,
    });

  } catch (error) {
    console.error("[ADMIN] Get machine stats error:", error);
    return res.status(500).json({
      error: "Failed to get machine statistics",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};