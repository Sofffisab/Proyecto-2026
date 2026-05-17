import { prisma } from "../prisma/prisma.js";
import { v4 as uuid } from "uuid";
import { sendPushAndNotification } from "./notifications.js";
import { NOTIFICATION_TYPES, formatDate, validateUsername } from "../shared/utils.js";

// ============ USERS SERVICE ============

export const getUserById = async (userId) => {
  return await prisma.user.findUnique({
    where: { id: userId },
  });
};

export const updateUserData = async (userId, data) => {
  return await prisma.user.update({
    where: { id: userId },
    data,
  });
};

// ============ USERS CONTROLLERS ============

export const getCurrentUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: {
        userPoints: true,
        profile: true,
        settings: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(formatUserResponse(user));
  } catch (error) {
    console.error("[USERS] Get current user error:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
};

export const getUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userPoints: true,
        profile: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(formatUserResponse(user));
  } catch (error) {
    console.error("[USERS] Get user error:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { fullName, username, email } = req.body;

    if (username && !validateUsername(username)) {
      return res.status(400).json({ error: "Invalid username format" });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(fullName && { fullName }),
        ...(username && { username }),
        ...(email && { email }),
        ...(req.file && { photo: await photoToBase64(req.file) }),
      },
    });

    res.status(200).json({
      message: "User updated successfully",
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error("[USERS] Update user error:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    await prisma.user.delete({
      where: { id: userId },
    });

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("[USERS] Delete user error:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
};

export const pauseAccount = async (req, res) => {
  try {
    const { userId } = req.params;
    const { pause } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: { accountPaused: pause },
    });

    await sendPushAndNotification(
      userId,
      NOTIFICATION_TYPES.ACCOUNT_PAUSED,
      "Account Status",
      pause ? "Your account has been paused" : "Your account is active",
      { status: pause ? "paused" : "active" }
    );

    res.status(200).json({
      message: `Account ${pause ? "paused" : "activated"} successfully`,
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error("[USERS] Pause account error:", error);
    res.status(500).json({ error: "Failed to pause account" });
  }
};

// ============ PROFILES CONTROLLERS ============

export const getProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    const profile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.status(200).json(profile);
  } catch (error) {
    console.error("[PROFILES] Get profile error:", error);
    res.status(500).json({ error: "Failed to get profile" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const { age, weight, height, fitnessLevel, goals, injuries } = req.body;

    const profile = await prisma.userProfile.upsert({
      where: { userId },
      update: {
        ...(age && { age }),
        ...(weight && { weight }),
        ...(height && { height }),
        ...(fitnessLevel && { fitnessLevel }),
        ...(goals && { goals }),
        ...(injuries && { injuries }),
      },
      create: {
        userId,
        age: age || null,
        weight: weight || null,
        height: height || null,
        fitnessLevel: fitnessLevel || "beginner",
        goals: goals || [],
        injuries: injuries || [],
      },
    });

    res.status(200).json({
      message: "Profile updated successfully",
      profile,
    });
  } catch (error) {
    console.error("[PROFILES] Update profile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
};

export const completeProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const { age, weight, height, fitnessLevel, goals } = req.body;

    if (!age || !weight || !height || !fitnessLevel || !goals) {
      return res.status(400).json({ error: "All profile fields are required" });
    }

    await prisma.userProfile.create({
      data: {
        userId,
        age,
        weight,
        height,
        fitnessLevel,
        goals,
        injuries: [],
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { profileComplete: true },
    });

    res.status(201).json({ message: "Profile completed successfully" });
  } catch (error) {
    console.error("[PROFILES] Complete profile error:", error);
    res.status(500).json({ error: "Failed to complete profile" });
  }
};

export const getProfileStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    res.status(200).json({
      profileComplete: user?.profileComplete || false,
    });
  } catch (error) {
    console.error("[PROFILES] Get profile status error:", error);
    res.status(500).json({ error: "Failed to get profile status" });
  }
};

// ============ SETTINGS CONTROLLERS ============

export const getSettings = async (req, res) => {
  try {
    const { userId } = req.params;

    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      const newSettings = await prisma.userSettings.create({
        data: {
          userId,
          theme: "light",
          notifications: true,
          pushNotifications: true,
          emailNotifications: true,
          language: "en",
        },
      });
      return res.status(200).json(newSettings);
    }

    res.status(200).json(settings);
  } catch (error) {
    console.error("[SETTINGS] Get settings error:", error);
    res.status(500).json({ error: "Failed to get settings" });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const { userId } = req.params;
    const { theme, notifications, pushNotifications, emailNotifications, language } = req.body;

    const settings = await prisma.userSettings.upsert({
      where: { userId },
      update: {
        ...(theme && { theme }),
        ...(notifications !== undefined && { notifications }),
        ...(pushNotifications !== undefined && { pushNotifications }),
        ...(emailNotifications !== undefined && { emailNotifications }),
        ...(language && { language }),
      },
      create: {
        userId,
        theme: theme || "light",
        notifications: notifications !== undefined ? notifications : true,
        pushNotifications: pushNotifications !== undefined ? pushNotifications : true,
        emailNotifications: emailNotifications !== undefined ? emailNotifications : true,
        language: language || "en",
      },
    });

    res.status(200).json({
      message: "Settings updated successfully",
      settings,
    });
  } catch (error) {
    console.error("[SETTINGS] Update settings error:", error);
    res.status(500).json({ error: "Failed to update settings" });
  }
};

export const updatePushToken = async (req, res) => {
  try {
    const { pushToken } = req.body;

    if (!pushToken) {
      return res.status(400).json({ error: "Push token is required" });
    }

    await prisma.user.update({
      where: { id: req.userId },
      data: { pushToken },
    });

    res.status(200).json({ message: "Push token updated successfully" });
  } catch (error) {
    console.error("[USERS] Update push token error:", error);
    res.status(500).json({ error: "Failed to update push token" });
  }
};

export const getWrapped = async (req, res) => {
  try {
    const { userId } = req.params;

    const stats = await prisma.checkIn.groupBy({
      by: ["userId"],
      where: { userId },
      _count: { id: true },
    });

    const totalCheckIns = stats[0]?._count.id || 0;

    const checkIns = await prisma.checkIn.findMany({
      where: { userId },
      orderBy: { entryTime: "desc" },
      take: 1,
    });

    const lastCheckIn = checkIns[0]?.entryTime || null;

    const points = await prisma.userPoints.findUnique({
      where: { userId },
    });

    res.status(200).json({
      totalCheckIns,
      lastCheckIn,
      points: points?.currentPoints || 0,
      wrapped: {
        year: new Date().getFullYear(),
        checkIns: totalCheckIns,
        points: points?.currentPoints || 0,
      },
    });
  } catch (error) {
    console.error("[USERS] Get wrapped error:", error);
    res.status(500).json({ error: "Failed to get wrapped data" });
  }
};

// ============ PERSONALIZATIONS CONTROLLERS ============

export const getPersonalizations = async (req, res) => {
  try {
    const { userId } = req.params;

    const personalizations = await prisma.userPersonalization.findMany({
      where: { userId },
    });

    res.status(200).json(personalizations);
  } catch (error) {
    console.error("[PERSONALIZATIONS] Get personalizations error:", error);
    res.status(500).json({ error: "Failed to get personalizations" });
  }
};

export const setPersonalization = async (req, res) => {
  try {
    const { userId } = req.params;
    const { fieldName, value } = req.body;

    if (!fieldName || value === undefined) {
      return res.status(400).json({ error: "Field name and value are required" });
    }

    const personalization = await prisma.userPersonalization.upsert({
      where: {
        userId_fieldName: {
          userId,
          fieldName,
        },
      },
      update: { value },
      create: {
        userId,
        fieldName,
        value,
      },
    });

    res.status(200).json({
      message: "Personalization set successfully",
      personalization,
    });
  } catch (error) {
    console.error("[PERSONALIZATIONS] Set personalization error:", error);
    res.status(500).json({ error: "Failed to set personalization" });
  }
};

export const deletePersonalization = async (req, res) => {
  try {
    const { userId, fieldName } = req.params;

    await prisma.userPersonalization.delete({
      where: {
        userId_fieldName: {
          userId,
          fieldName,
        },
      },
    });

    res.status(200).json({ message: "Personalization deleted successfully" });
  } catch (error) {
    console.error("[PERSONALIZATIONS] Delete personalization error:", error);
    res.status(500).json({ error: "Failed to delete personalization" });
  }
};

// ============ HELPERS ============

const photoToBase64 = async (file) => {
  return file.buffer.toString("base64");
};

const formatUserResponse = (user) => {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    username: user.username,
    role: user.role,
    profileComplete: user.profileComplete,
    accountPaused: user.accountPaused,
    photo: user.photo ? `data:image/jpeg;base64,${user.photo}` : null,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
    points: user.userPoints?.currentPoints || 0,
    profile: user.profile || null,
    settings: user.settings || null,
  };
};