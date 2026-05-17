import { prisma } from "../prisma/prisma.js";
import { v4 as uuid } from "uuid";
import admin from "firebase-admin";
import { NOTIFICATION_TYPES } from "../shared/utils.js";

let firebaseInitialized = false;

// ============ FIREBASE SERVICE ============

export const initializeFirebase = async () => {
  try {
    if (firebaseInitialized) return;

    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (!serviceAccountPath) {
      console.warn("[FIREBASE] Service account path not configured, notifications disabled");
      return;
    }

    const serviceAccount = await import(serviceAccountPath, {
      assert: { type: "json" },
    });

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount.default || serviceAccount),
    });

    firebaseInitialized = true;
    console.log("[FIREBASE] Initialized successfully");
  } catch (error) {
    console.error("[FIREBASE] Initialization error:", error);
  }
};

export const sendToDevice = async (pushToken, notification) => {
  try {
    if (!firebaseInitialized) {
      console.warn("[FIREBASE] Not initialized, skipping push");
      return null;
    }

    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
      token: pushToken,
    };

    const response = await admin.messaging().send(message);
    return response;
  } catch (error) {
    console.error("[FIREBASE] Send to device error:", error);
    return null;
  }
};

export const sendMulticast = async (pushTokens, notification) => {
  try {
    if (!firebaseInitialized) {
      console.warn("[FIREBASE] Not initialized, skipping multicast");
      return null;
    }

    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
    };

    const response = await admin.messaging().sendMulticast({
      ...message,
      tokens: pushTokens,
    });

    return response;
  } catch (error) {
    console.error("[FIREBASE] Send multicast error:", error);
    return null;
  }
};

// ============ NOTIFICATIONS SERVICE ============

export const createNotification = async (userId, type, title, message, data = {}) => {
  try {
    const notification = await prisma.userNotification.create({
      data: {
        id: uuid(),
        userId,
        type,
        title,
        message,
        data: JSON.stringify(data),
        isRead: false,
      },
    });

    return notification;
  } catch (error) {
    console.error("[NOTIFICATIONS] Create notification error:", error);
    throw error;
  }
};

export const sendPush = async (userId, title, message, data = {}) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.pushToken) {
      console.warn(`[PUSH] No push token for user ${userId}`);
      return null;
    }

    const response = await sendToDevice(user.pushToken, {
      title,
      body: message,
      data,
    });

    return response;
  } catch (error) {
    console.error("[PUSH] Send push error:", error);
    return null;
  }
};

export const sendPushAndNotification = async (userId, type, title, message, data = {}) => {
  try {
    // Create database notification
    const notification = await createNotification(userId, type, title, message, data);

    // Send push notification
    await sendPush(userId, title, message, data);

    // Emit socket event
    const io = global.io;
    if (io) {
      io.to(`user-${userId}`).emit("notification:new", notification);
    }

    return notification;
  } catch (error) {
    console.error("[NOTIFICATIONS] Send push and notification error:", error);
    throw error;
  }
};

// ============ NOTIFICATIONS CONTROLLERS ============

export const getNotifications = async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const notifications = await prisma.userNotification.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    res.status(200).json(notifications);
  } catch (error) {
    console.error("[NOTIFICATIONS] Get notifications error:", error);
    res.status(500).json({ error: "Failed to get notifications" });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await prisma.userNotification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    res.status(200).json({
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    console.error("[NOTIFICATIONS] Mark as read error:", error);
    res.status(500).json({ error: "Failed to mark as read" });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    await prisma.userNotification.updateMany({
      where: {
        userId: req.userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    res.status(200).json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("[NOTIFICATIONS] Mark all as read error:", error);
    res.status(500).json({ error: "Failed to mark all as read" });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const count = await prisma.userNotification.count({
      where: {
        userId: req.userId,
        isRead: false,
      },
    });

    res.status(200).json({ unreadCount: count });
  } catch (error) {
    console.error("[NOTIFICATIONS] Get unread count error:", error);
    res.status(500).json({ error: "Failed to get unread count" });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;

    await prisma.userNotification.delete({
      where: { id: notificationId },
    });

    res.status(200).json({ message: "Notification deleted" });
  } catch (error) {
    console.error("[NOTIFICATIONS] Delete notification error:", error);
    res.status(500).json({ error: "Failed to delete notification" });
  }
};

export const clearNotifications = async (req, res) => {
  try {
    await prisma.userNotification.deleteMany({
      where: { userId: req.userId },
    });

    res.status(200).json({ message: "All notifications cleared" });
  } catch (error) {
    console.error("[NOTIFICATIONS] Clear notifications error:", error);
    res.status(500).json({ error: "Failed to clear notifications" });
  }
};