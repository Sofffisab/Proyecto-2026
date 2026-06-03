import admin from "firebase-admin";
import { prisma } from "../prisma/prisma.js";
import { ERROR_CODES, paginate, NOTIFICATION_TYPES } from "../shared/utils.js";

let firebaseInitialized = false;

export const initializeFirebase = async () => {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      firebaseInitialized = true;
      console.log("[FIREBASE] Initialized successfully");
    } else {
      console.log("[FIREBASE] No service account provided, push notifications disabled");
    }
  } catch (error) {
    console.error("[FIREBASE] Initialization error:", error);
  }
};

export const sendPushNotification = async (userId, title, body, data = {}) => {
  if (!firebaseInitialized) {
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        pushToken: true,
        settings: {
          select: { pushNotifications: true },
        },
      },
    });

    if (!user?.pushToken || !user?.settings?.pushNotifications) {
      return;
    }

    await admin.messaging().send({
      token: user.pushToken,
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      },
    });

    console.log(`[PUSH] Notification sent to user ${userId}`);
  } catch (error) {
    if (error.code === "messaging/registration-token-not-registered") {
      await prisma.user.update({
        where: { id: userId },
        data: { pushToken: null },
      });
      console.log(`[PUSH] Removed invalid token for user ${userId}`);
    } else {
      console.error("[PUSH] Error sending notification:", error);
    }
  }
};

export const createNotification = async (userId, type, title, message, data = null) => {
  try {
    const notification = await prisma.userNotification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: data ? JSON.stringify(data) : null,
      },
    });

    return notification;
  } catch (error) {
    console.error("[NOTIFICATIONS] Error creating notification:", error);
    return null;
  }
};

export const sendPushAndNotification = async (userId, type, title, message, data = {}) => {
  await Promise.all([
    createNotification(userId, type, title, message, data),
    sendPushNotification(userId, title, message, {
      type,
      ...Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
    }),
  ]);
};

// ============ NOTIFICATION ENDPOINTS ============

export const getNotifications = async (req, res) => {
  const { page = 1, limit = 20, unreadOnly } = req.query;

  try {
    const pagination = paginate(parseInt(page), parseInt(limit));
    const where = { userId: req.user.id };

    if (unreadOnly === "true") {
      where.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.userNotification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...pagination,
      }),
      prisma.userNotification.count({ where }),
      prisma.userNotification.count({
        where: { userId: req.user.id, isRead: false },
      }),
    ]);

    return res.status(200).json({
      notifications,
      unreadCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[NOTIFICATIONS] Get notifications error:", error);
    return res.status(500).json({
      error: "Failed to get notifications",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const markNotificationRead = async (req, res) => {
  const { notificationId } = req.params;

  try {
    const notification = await prisma.userNotification.findFirst({
      where: {
        id: notificationId,
        userId: req.user.id,
      },
    });

    if (!notification) {
      return res.status(404).json({
        error: "Notification not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    const updated = await prisma.userNotification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return res.status(200).json({
      message: "Notification marked as read",
      notification: updated,
    });
  } catch (error) {
    console.error("[NOTIFICATIONS] Mark notification read error:", error);
    return res.status(500).json({
      error: "Failed to mark notification as read",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    await prisma.userNotification.updateMany({
      where: {
        userId: req.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return res.status(200).json({
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("[NOTIFICATIONS] Mark all read error:", error);
    return res.status(500).json({
      error: "Failed to mark notifications as read",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const deleteNotification = async (req, res) => {
  const { notificationId } = req.params;

  try {
    const notification = await prisma.userNotification.findFirst({
      where: {
        id: notificationId,
        userId: req.user.id,
      },
    });

    if (!notification) {
      return res.status(404).json({
        error: "Notification not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    await prisma.userNotification.delete({
      where: { id: notificationId },
    });

    return res.status(200).json({
      message: "Notification deleted",
    });
  } catch (error) {
    console.error("[NOTIFICATIONS] Delete notification error:", error);
    return res.status(500).json({
      error: "Failed to delete notification",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ ALIASES FOR ROUTES ============

export const markAsRead = markNotificationRead;
export const markAllAsRead = markAllNotificationsRead;

// ============ UNREAD COUNT ============

export const getUnreadCount = async (req, res) => {
  try {
    const count = await prisma.userNotification.count({
      where: {
        userId: req.user.id,
        isRead: false,
      },
    });

    return res.status(200).json({ unreadCount: count });
  } catch (error) {
    console.error("[NOTIFICATIONS] Get unread count error:", error);
    return res.status(500).json({
      error: "Failed to get unread count",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ CLEAR ALL NOTIFICATIONS ============

export const clearNotifications = async (req, res) => {
  try {
    await prisma.userNotification.deleteMany({
      where: { userId: req.user.id },
    });

    return res.status(200).json({
      message: "All notifications cleared",
    });
  } catch (error) {
    console.error("[NOTIFICATIONS] Clear notifications error:", error);
    return res.status(500).json({
      error: "Failed to clear notifications",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};