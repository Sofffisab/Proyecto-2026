import { Resend } from "resend";
import prisma from "../config/prisma.js";

// Lazy singleton: avoids crashing at import time (e.g. in tests) when
// RESEND_API_KEY isn't set. Only instantiated the first time an email is sent.
let _resend = null;
function getResendClient() {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_key_for_tests");
  }
  return _resend;
}

// ============================================
// IN-APP NOTIFICATIONS
// ============================================

export async function createNotification(userId, title, body = "") {
  return prisma.notification.create({
    data: { userId, title, body, read: false },
  });
}

export async function getNotifications(userId, { limit = 20, offset = 0 } = {}) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
}

/**
 * Marks a notification as read only if it belongs to the requesting user.
 * @param {string} notificationId
 * @param {string} userId - The authenticated user's ID (ownership check)
 */
export async function markAsRead(notificationId, userId) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification || notification.userId !== userId) {
    throw new Error("Notification not found or does not belong to this user");
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });
}

export async function markAllAsRead(userId) {
  return prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}

/**
 * Deletes a notification only if it belongs to the requesting user.
 * @param {string} id - Notification ID
 * @param {string} userId - The authenticated user's ID (ownership check)
 */
export async function deleteNotification(id, userId) {
  const notification = await prisma.notification.findUnique({
    where: { id },
  });

  if (!notification || notification.userId !== userId) {
    throw new Error("Notification not found or does not belong to this user");
  }

  return prisma.notification.delete({ where: { id } });
}

export async function getUnreadCount(userId) {
  return prisma.notification.count({ where: { userId, read: false } });
}

// ============================================
// EMAIL (Resend)
// ============================================

export async function sendEmail(to, subject, html) {
  try {
    return await getResendClient().emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error("[communication.service] Failed to send email:", err.message);
    return { success: false, error: err.message };
  }
}

export async function sendWelcomeEmail(email, name, userId = null) {
  if (userId) {
    await createNotification(userId, "Welcome!", `Welcome ${name}!`);
  }

  return sendEmail(
    email,
    "Welcome to Gym App",
    `<h1>Hello ${name}!</h1><p>Welcome to our platform. Time to train!</p>`
  );
}

export async function sendPasswordResetEmail(email, resetToken, userId = null) {
  if (userId) {
    await createNotification(userId, "Password reset requested", "");
  }

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  return sendEmail(
    email,
    "Reset your password",
    `<p>Click the link below to reset your password (valid for 1 hour):</p>
     <a href="${resetUrl}">${resetUrl}</a>`
  );
}

export async function sendProgressEmail(email, message) {
  return sendEmail(email, "Progress update", `<p>${message}</p>`);
}

// ============================================
// COMBINED — in-app + email
// ============================================

export async function notify(userId, title, email) {
  await createNotification(userId, title);
  await sendEmail(email, title, `<p>${title}</p>`);
}

// ============================================
// Namespaced export for convenience
// ============================================

export const communicationService = {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendProgressEmail,
  notify,
};
