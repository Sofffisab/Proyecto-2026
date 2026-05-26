import { prisma } from "../prisma/prisma.js";
import { ERROR_CODES, paginate } from "../shared/utils.js";

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

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { photoUrl: photoBase64 },
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