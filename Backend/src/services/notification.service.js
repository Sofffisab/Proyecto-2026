import prisma from "../config/prisma.js";

export async function createNotification(userId, title, body) {
  return prisma.notification.create({
    data: {
      userId,
      title,
      body,
    },
  });
}

export async function getNotifications(userId) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function markAsRead(notificationId) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });
}