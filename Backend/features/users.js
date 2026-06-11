import { prisma } from "../prisma/prisma.js";
import { ERROR_CODES, paginate } from "../shared/utils.js";
import { put, del } from '@vercel/blob';

// ============ PROFILE ============

export const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        username: true,
        role: true,
        photoUrl: true,
        profileComplete: true,
        createdAt: true,
        profile: true,
        userPoints: {
          select: {
            totalPoints: true,
            currentPoints: true,
          },
        },
      },
    });

    return res.status(200).json({ user });
  } catch (error) {
    console.error("[USERS] Get profile error:", error);
    return res.status(500).json({
      error: "Failed to get profile",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const updateProfile = async (req, res) => {
  const { fullName, age, weight, height, fitnessLevel, goals, injuries } = req.body;

  try {
    const updateData = {};
    const profileData = {};

    if (fullName !== undefined) updateData.fullName = fullName;
    if (age !== undefined) profileData.age = age;
    if (weight !== undefined) profileData.weight = weight;
    if (height !== undefined) profileData.height = height;
    if (fitnessLevel !== undefined) profileData.fitnessLevel = fitnessLevel;
    if (goals !== undefined) profileData.goals = goals;
    if (injuries !== undefined) profileData.injuries = injuries;

    const profileComplete =
      profileData.age !== undefined &&
      profileData.weight !== undefined &&
      profileData.height !== undefined &&
      profileData.fitnessLevel !== undefined;

    if (profileComplete) {
      updateData.profileComplete = true;
    }

    // Use transaction to ensure consistency when logging weight
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: req.user.id },
        data: {
          ...updateData,
          profile: {
            update: profileData,
          },
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          username: true,
          role: true,
          photoUrl: true,
          profileComplete: true,
          profile: true,
        },
      });

      // Log weight if changed
      if (weight !== undefined) {
        await tx.weightLog.create({
          data: {
            userId: req.user.id,
            weight,
          },
        });
      }

      return user;
    });

    return res.status(200).json({
      message: "Profile updated",
      user: result,
    });
  } catch (error) {
    console.error("[USERS] Update profile error:", error);
    return res.status(500).json({
      error: "Failed to update profile",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ SETTINGS ============

export const getSettings = async (req, res) => {
  try {
    const settings = await prisma.userSettings.findUnique({
      where: { userId: req.user.id },
    });

    return res.status(200).json({ settings });
  } catch (error) {
    console.error("[USERS] Get settings error:", error);
    return res.status(500).json({
      error: "Failed to get settings",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const updateSettings = async (req, res) => {
  const {
    theme,
    notifications,
    pushNotifications,
    emailNotifications,
    language,
    allowSocialRequests,
    allowTrainerContact,
    minimalMode,
  } = req.body;

  try {
    const updateData = {};

    if (theme !== undefined) updateData.theme = theme;
    if (notifications !== undefined) updateData.notifications = notifications;
    if (pushNotifications !== undefined) updateData.pushNotifications = pushNotifications;
    if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications;
    if (language !== undefined) updateData.language = language;
    if (allowSocialRequests !== undefined) updateData.allowSocialRequests = allowSocialRequests;
    if (allowTrainerContact !== undefined) updateData.allowTrainerContact = allowTrainerContact;
    if (minimalMode !== undefined) updateData.minimalMode = minimalMode;

    const settings = await prisma.userSettings.update({
      where: { userId: req.user.id },
      data: updateData,
    });

    return res.status(200).json({
      message: "Settings updated",
      settings,
    });
  } catch (error) {
    console.error("[USERS] Update settings error:", error);
    return res.status(500).json({
      error: "Failed to update settings",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ PUSH TOKEN ============

export const updatePushToken = async (req, res) => {
  const { pushToken } = req.body;

  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { pushToken },
    });

    return res.status(200).json({
      message: "Push token updated",
    });
  } catch (error) {
    console.error("[USERS] Update push token error:", error);
    return res.status(500).json({
      error: "Failed to update push token",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ PHOTO ============

export const uploadPhoto = async (req, res) => {
  try {
    const { photoBase64 } = req.body;

    if (!photoBase64) {
      return res.status(400).json({
        error: "Photo is required",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { photoUrl: true },
    });

    const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    
    const mimeMatch = photoBase64.match(/^data:(image\/\w+);base64,/);
    const contentType = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const extension = contentType.split("/")[1];

    const blob = await put(
      `avatars/${req.user.id}-${Date.now()}.${extension}`,
      buffer,
      {
        access: "public",
        contentType,
      }
    );

    if (currentUser?.photoUrl?.includes("blob.vercel-storage.com")) {
      try {
        await del(currentUser.photoUrl);
      } catch (e) {
        console.warn("[USERS] Failed to delete old photo:", e);
      }
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { photoUrl: blob.url },
      select: {
        id: true,
        photoUrl: true,
      },
    });

    return res.status(200).json({
      message: "Photo uploaded",
      photoUrl: user.photoUrl,
    });
  } catch (error) {
    console.error("[USERS] Upload photo error:", error);
    return res.status(500).json({
      error: "Failed to upload photo",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ ROUTINES ============

export const getRoutines = async (req, res) => {
  try {
    const routines = await prisma.userRoutine.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ routines });
  } catch (error) {
    console.error("[USERS] Get routines error:", error);
    return res.status(500).json({
      error: "Failed to get routines",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const createRoutine = async (req, res) => {
  const { name, description, exercises, daysOfWeek, reminderTime, remindersEnabled } = req.body;

  if (!name) {
    return res.status(400).json({
      error: "Routine name is required",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const routine = await prisma.userRoutine.create({
      data: {
        userId: req.user.id,
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
    console.error("[USERS] Create routine error:", error);
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
    const routine = await prisma.userRoutine.findFirst({
      where: { id: routineId, userId: req.user.id },
    });

    if (!routine) {
      return res.status(404).json({
        error: "Routine not found",
        code: ERROR_CODES.NOT_FOUND,
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
    console.error("[USERS] Update routine error:", error);
    return res.status(500).json({
      error: "Failed to update routine",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const deleteRoutine = async (req, res) => {
  const { routineId } = req.params;

  try {
    const routine = await prisma.userRoutine.findFirst({
      where: { id: routineId, userId: req.user.id },
    });

    if (!routine) {
      return res.status(404).json({
        error: "Routine not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    await prisma.userRoutine.delete({
      where: { id: routineId },
    });

    return res.status(200).json({
      message: "Routine deleted",
    });
  } catch (error) {
    console.error("[USERS] Delete routine error:", error);
    return res.status(500).json({
      error: "Failed to delete routine",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ WEIGHT HISTORY ============

export const getWeightHistory = async (req, res) => {
  const { page = 1, limit = 30 } = req.query;

  try {
    const pagination = paginate(parseInt(page), parseInt(limit));

    const [logs, total] = await Promise.all([
      prisma.weightLog.findMany({
        where: { userId: req.user.id },
        orderBy: { recordedAt: "desc" },
        ...pagination,
      }),
      prisma.weightLog.count({ where: { userId: req.user.id } }),
    ]);

    return res.status(200).json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[USERS] Get weight history error:", error);
    return res.status(500).json({
      error: "Failed to get weight history",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const addWeightLog = async (req, res) => {
  const { weight, recordedAt } = req.body;

  if (!weight || typeof weight !== "number" || weight <= 0) {
    return res.status(400).json({
      error: "Valid weight is required (must be a positive number)",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    // Use transaction to update both weight log and profile
    const [log] = await prisma.$transaction([
      prisma.weightLog.create({
        data: {
          userId: req.user.id,
          weight,
          recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
        },
      }),
      prisma.userProfile.update({
        where: { userId: req.user.id },
        data: { weight },
      }),
    ]);

    return res.status(201).json({
      message: "Weight logged",
      log,
    });
  } catch (error) {
    console.error("[USERS] Add weight log error:", error);
    return res.status(500).json({
      error: "Failed to log weight",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const deleteWeightLog = async (req, res) => {
  const { logId } = req.params;

  try {
    const log = await prisma.weightLog.findFirst({
      where: { id: logId, userId: req.user.id },
    });

    if (!log) {
      return res.status(404).json({
        error: "Weight log not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    await prisma.weightLog.delete({
      where: { id: logId },
    });

    return res.status(200).json({
      message: "Weight log deleted",
    });
  } catch (error) {
    console.error("[USERS] Delete weight log error:", error);
    return res.status(500).json({
      error: "Failed to delete weight log",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ CURRENT USER ============

export const getCurrentUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        username: true,
        role: true,
        photoUrl: true,
        profileComplete: true,
        createdAt: true,
        profile: true,
        settings: true,
        userPoints: {
          select: {
            totalPoints: true,
            currentPoints: true,
          },
        },
      },
    });

    return res.status(200).json({ user });
  } catch (error) {
    console.error("[USERS] Get current user error:", error);
    return res.status(500).json({
      error: "Failed to get user",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ GET USER BY ID ============

export const getUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
        profile: true,
        userPoints: {
          select: {
            totalPoints: true,
            currentPoints: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error("[USERS] Get user error:", error);
    return res.status(500).json({
      error: "Failed to get user",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ UPDATE USER ============

export const updateUser = async (req, res) => {
  const { userId } = req.params;
  const { fullName, username, email } = req.body;
  const photo = req.file;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, photoUrl: true },
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    const updateData = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (username !== undefined) updateData.username = username.toLowerCase();
    if (email !== undefined) updateData.email = email.toLowerCase();
    if (photo) { 
      const extension = photo.mimetype.split("/")[1] || "jpeg";
      const blob = await put(
        `avatars/${userId}-${Date.now()}.${extension}`,
        photo.buffer,
        {
          access: "public",
          contentType: photo.mimetype,
        }
      );

      if (user.photoUrl?.includes("blob.vercel-storage.com")) {
        try {
          await del(user.photoUrl);
        } catch (e) {
          console.warn("[USERS] Failed to delete old photo:", e);
        }
      }

      updateData.photoUrl = blob.url;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        fullName: true,
        username: true,
        role: true,
        photoUrl: true,
        profileComplete: true,
      },
    });

    
    return res.status(200).json({
      message: "User updated",
      user: updatedUser,
    });

  } catch (error) {
    if (error.code === "P2002") {
      const field = error.meta?.target?.[0];
      return res.status(409).json({
        error: `A user with this ${field} already exists`,
        code: ERROR_CODES.DUPLICATE_ENTRY,
        field,
      });
    }
    console.error("[USERS] Update user error:", error);
    return res.status(500).json({
      error: "Failed to update user",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ DELETE USER ============

export const deleteUser = async (req, res) => {
  const { userId } = req.params;

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

    await prisma.user.delete({
      where: { id: userId },
    });

    return res.status(200).json({
      message: "User deleted",
    });
  } catch (error) {
    console.error("[USERS] Delete user error:", error);
    return res.status(500).json({
      error: "Failed to delete user",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ PAUSE ACCOUNT ============

export const pauseAccount = async (req, res) => {
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

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        accountPaused: paused,
        tokenVersion: paused ? { increment: 1 } : undefined,
      },
      select: {
        id: true,
        accountPaused: true,
      },
    });

    return res.status(200).json({
      message: `Account ${paused ? "paused" : "unpaused"}`,
      user: updatedUser,
    });
  } catch (error) {
    console.error("[USERS] Pause account error:", error);
    return res.status(500).json({
      error: "Failed to update account status",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ COMPLETE PROFILE ============

export const completeProfile = async (req, res) => {
  const { userId } = req.params;
  const { age, weight, height, fitnessLevel, goals, injuries } = req.body;

  if (!age || !weight || !height || !fitnessLevel) {
    return res.status(400).json({
      error: "Age, weight, height, and fitness level are required",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        profileComplete: true,
        profile: {
          update: {
            age,
            weight,
            height,
            fitnessLevel,
            goals: goals || [],
            injuries: injuries || [],
          },
        },
      },
      select: {
        id: true,
        profileComplete: true,
        profile: true,
      },
    });

    return res.status(200).json({
      message: "Profile completed",
      user,
    });
  } catch (error) {
    console.error("[USERS] Complete profile error:", error);
    return res.status(500).json({
      error: "Failed to complete profile",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ GET PROFILE STATUS ============

export const getProfileStatus = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        profileComplete: true,
        profile: {
          select: {
            age: true,
            weight: true,
            height: true,
            fitnessLevel: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    const missingFields = [];
    if (!user.profile?.age) missingFields.push("age");
    if (!user.profile?.weight) missingFields.push("weight");
    if (!user.profile?.height) missingFields.push("height");
    if (!user.profile?.fitnessLevel) missingFields.push("fitnessLevel");

    return res.status(200).json({
      profileComplete: user.profileComplete,
      missingFields,
    });
  } catch (error) {
    console.error("[USERS] Get profile status error:", error);
    return res.status(500).json({
      error: "Failed to get profile status",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ PERSONALIZATIONS ============

export const getPersonalizations = async (req, res) => {
  const { userId } = req.params;

  try {
    const personalizations = await prisma.userPersonalization.findMany({
      where: { userId },
    });

    const personalizationsMap = {};
    personalizations.forEach((p) => {
      personalizationsMap[p.fieldName] = p.value;
    });

    return res.status(200).json({ personalizations: personalizationsMap });
  } catch (error) {
    console.error("[USERS] Get personalizations error:", error);
    return res.status(500).json({
      error: "Failed to get personalizations",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const setPersonalization = async (req, res) => {
  const { userId } = req.params;
  const { fieldName, value } = req.body;

  if (!fieldName || value === undefined) {
    return res.status(400).json({
      error: "Field name and value are required",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const personalization = await prisma.userPersonalization.upsert({
      where: {
        userId_fieldName: { userId, fieldName },
      },
      update: { value },
      create: { userId, fieldName, value },
    });

    return res.status(200).json({
      message: "Personalization saved",
      personalization,
    });
  } catch (error) {
    console.error("[USERS] Set personalization error:", error);
    return res.status(500).json({
      error: "Failed to save personalization",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const deletePersonalization = async (req, res) => {
  const { userId, fieldName } = req.params;

  try {
    await prisma.userPersonalization.delete({
      where: {
        userId_fieldName: { userId, fieldName },
      },
    });

    return res.status(200).json({
      message: "Personalization deleted",
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({
        error: "Personalization not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    console.error("[USERS] Delete personalization error:", error);
    return res.status(500).json({
      error: "Failed to delete personalization",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ WRAPPED / STATS SUMMARY ============

export const getWrapped = async (req, res) => {
  const { userId } = req.params;

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [checkIns, machineUsages, helpRequests, progressUpdates, userPoints] = await Promise.all([
      prisma.checkIn.count({
        where: { userId, entryTime: { gte: thirtyDaysAgo } },
      }),
      prisma.machineUsage.count({
        where: { userId, startTime: { gte: thirtyDaysAgo } },
      }),
      prisma.helpRequest.count({
        where: { userId, createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.progressUpdate.count({
        where: { userId, status: "approved", createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.userPoints.findUnique({
        where: { userId },
        select: { totalPoints: true, currentPoints: true },
      }),
    ]);

    return res.status(200).json({
      wrapped: {
        period: "30 days",
        checkIns,
        machineUsages,
        helpRequests,
        progressUpdates,
        points: userPoints || { totalPoints: 0, currentPoints: 0 },
      },
    });
  } catch (error) {
    console.error("[USERS] Get wrapped error:", error);
    return res.status(500).json({
      error: "Failed to get wrapped",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const getWrapped = async (req, res) => {
  const { userId } = req.params;

  try {
    const [
      user,
      totalCheckIns,
      totalMinutes,
      pointsData,
      machinesUsed,
      topMachine,
      topExercise,
      streakData
    ] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.checkIn.count({ where: { userId } }),
      prisma.checkIn.aggregate({
        where: { userId, checkOutTime: { not: null } },
        _sum: { duration: true }
      }),
      prisma.userPoints.findUnique({
        where: { userId },
        select: { totalPoints: true, currentPoints: true }
      }),
      prisma.machineUsage.groupBy({
        by: ["machineId"],
        where: { userId },
        _count: true,
        orderBy: { _count: { machineId: "desc" } },
        take: 3
      }),
      prisma.machineUsage.groupBy({
        by: ["machineId"],
        where: { userId },
        _count: true,
        orderBy: { _count: { machineId: "desc" } },
        take: 1
      }),
      prisma.userRoutine.findMany({
        where: { userId, completedCount: { gt: 0 } },
        select: { name: true, completedCount: true },
        orderBy: { completedCount: "desc" },
        take: 1
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true }
      })
    ]);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentCheckIns = await prisma.checkIn.findMany({
      where: { userId, checkInTime: { gte: thirtyDaysAgo } },
      select: { checkInTime: true },
      orderBy: { checkInTime: "desc" }
    });

    let currentStreak = 0;
    let lastDate = null;
    for (const checkIn of recentCheckIns) {
      const checkInDate = new Date(checkIn.checkInTime).toDateString();
      if (!lastDate) {
        lastDate = checkInDate;
        currentStreak = 1;
      } else if (new Date(lastDate).getTime() - new Date(checkInDate).getTime() <= 24 * 60 * 60 * 1000) {
        currentStreak++;
        lastDate = checkInDate;
      } else {
        break;
      }
    }

    return res.status(200).json({
      wrapped: {
        user: {
          name: user.fullName,
          username: user.username,
          joinDate: user.createdAt,
        },
        stats: {
          totalCheckIns,
          totalMinutes: totalMinutes._sum.duration || 0,
          totalPoints: pointsData?.totalPoints || 0,
          currentStreak,
          machinesUsed: machinesUsed.length,
          topMachine: topMachine[0] || null,
          topExercise: topExercise[0] || null,
        },
        achievements: {
          checkInsThisMonth: totalCheckIns > 20 ? "Consistency King" : null,
          pointsEarned: (pointsData?.totalPoints || 0) > 1000 ? "Points Champion" : null,
          machinesMastered: machinesUsed.length > 5 ? "Equipment Master" : null,
        },
      },
    });
  } catch (error) {
    console.error("[USERS] Get wrapped error:", error);
    return res.status(500).json({
      error: "Failed to get wrapped data",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// AGREGAR AL FINAL DE users.js (antes de export default)

export async function getWrapped(req, res) {
  try {
    const { userId } = req.user;
    
    // Verificar que userId existe
    if (!userId) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'User not authenticated'
      });
    }

    // Obtener datos del usuario
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        progress: {
          where: {
            createdAt: {
              gte: new Date(new Date().getFullYear(), 0, 1) // Desde inicio del año
            }
          }
        },
        rewards: {
          where: {
            claimedAt: {
              gte: new Date(new Date().getFullYear(), 0, 1)
            }
          }
        },
        routines: true,
        checkIns: {
          where: {
            createdAt: {
              gte: new Date(new Date().getFullYear(), 0, 1)
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'not_found',
        message: 'User not found'
      });
    }

    // Calcular estadísticas anuales
    const totalWorkouts = user.checkIns.length;
    const totalPoints = user.progress.reduce((sum, p) => sum + (p.pointsGained || 0), 0);
    const totalRewardsClaimed = user.rewards.filter(r => r.claimedAt).length;
    const favoriteRoutine = user.routines.sort((a, b) => 
      b.completedCount - a.completedCount
    )[0];

    // Calcular promedio de calorías por mes
    const monthlyStats = {};
    user.checkIns.forEach(checkin => {
      const month = new Date(checkin.createdAt).getMonth();
      if (!monthlyStats[month]) {
        monthlyStats[month] = { count: 0, calories: 0 };
      }
      monthlyStats[month].count += 1;
      monthlyStats[month].calories += checkin.caloriesBurned || 0;
    });

    res.status(200).json({
      year: new Date().getFullYear(),
      totalWorkouts,
      totalPoints,
      totalRewardsClaimed,
      favoriteRoutine: favoriteRoutine ? favoriteRoutine.name : null,
      averageCaloriesPerMonth: Object.entries(monthlyStats).map(([month, data]) => ({
        month: parseInt(month),
        workouts: data.count,
        calories: Math.round(data.calories / (data.count || 1))
      })),
      streakDays: calculateStreak(user.checkIns),
      level: Math.floor(totalPoints / 1000) + 1,
      nextLevelPoints: ((Math.floor(totalPoints / 1000) + 1) * 1000) - totalPoints
    });

  } catch (error) {
    console.error('[users.getWrapped]', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to fetch wrapped data'
    });
  }
}

export async function getPersonalizations(req, res) {
  try {
    const { userId } = req.user;

    const personalizations = await db.userPersonalization.findMany({
      where: { userId }
    });

    res.status(200).json(personalizations || []);
  } catch (error) {
    console.error('[users.getPersonalizations]', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to fetch personalizations'
    });
  }
}

export async function setPersonalization(req, res) {
  try {
    const { userId } = req.user;
    const { key, value } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json({
        error: 'invalid_input',
        message: 'key and value are required'
      });
    }

    const personalization = await db.userPersonalization.upsert({
      where: { userId_key: { userId, key } },
      update: { value },
      create: { userId, key, value }
    });

    res.status(200).json(personalization);
  } catch (error) {
    console.error('[users.setPersonalization]', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to set personalization'
    });
  }
}

export async function deletePersonalization(req, res) {
  try {
    const { userId } = req.user;
    const { key } = req.params;

    await db.userPersonalization.delete({
      where: { userId_key: { userId, key } }
    });

    res.status(204).send();
  } catch (error) {
    console.error('[users.deletePersonalization]', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to delete personalization'
    });
  }
}

function calculateStreak(checkIns) {
  if (checkIns.length === 0) return 0;
  
  const sortedCheckIns = checkIns.sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  );

  let streak = 1;
  const today = new Date();
  let currentDate = new Date(sortedCheckIns[0].createdAt);

  for (let i = 1; i < sortedCheckIns.length; i++) {
    const nextDate = new Date(sortedCheckIns[i].createdAt);
    const dayDiff = Math.floor((currentDate - nextDate) / (1000 * 60 * 60 * 24));
    
    if (dayDiff === 1) {
      streak += 1;
      currentDate = nextDate;
    } else {
      break;
    }
  }

  return streak;
}