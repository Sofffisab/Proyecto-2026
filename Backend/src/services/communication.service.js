import { Resend } from "resend";
import { prisma } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { MESSAGES } from "../locales/es.js";

// Lazy singleton: avoids crashing at import time (e.g. in tests) when
// RESEND_API_KEY isn't set. Only instantiated the first time an email is sent.
let _resend = null;
function getResendClient() {
  if (!_resend) {
    // RESEND_API_KEY is required at startup for real environments; fallback is test-only
    const apiKey =
      process.env.RESEND_API_KEY ??
      (process.env.NODE_ENV === "test" ? "re_dummy_key_for_tests" : undefined);
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    _resend = new Resend(apiKey);
  }
  return _resend;
}

// IN-APP NOTIFICATIONS

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

// Marks a notification as read, only if it belongs to the requesting user.
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

// Deletes a notification, only if it belongs to the requesting user.
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

// EMAIL (Resend)

export async function sendEmail(to, subject, html) {
  try {
    return await getResendClient().emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to,
      subject,
      html,
    });
  } catch (err) {
    logger.error("[communication.service] Failed to send email:", err.message);
    return { success: false, error: err.message };
  }
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

// Congratulatory email sent the moment a goal is fully completed (100%) —
// NOT on every routine progress update, only on this milestone (see
// progress.service.js#addProgress).
export async function sendProgressEmail(email, name, goalLabel) {
  return sendEmail(
    email,
    "Goal completed! 🎉",
    `<h2>Congratulations, ${name}!</h2><p>You've just completed your goal: <strong>${goalLabel}</strong>. Keep up the great work!</p>`
  );
}

// In-app alert to a trainer when a student they haven't helped in a while
// (or never) just checked in. Includes the student's current location.
export async function notifyTrainerOfReturningStudent(
  trainerId,
  student,
  { checkInAt, daysSinceLastAssistance, location }
) {
  const studentName = `${student.firstName} ${student.lastName}`.trim();
  // Fall back only if the caller couldn't resolve a location
  const resolvedLocation = location || MESSAGES.LOCATION_UNKNOWN;

  const title = MESSAGES.TRAINER_ATTENTION_NEEDED_TITLE;
  const body =
    daysSinceLastAssistance == null
      ? MESSAGES.studentNeedsHelpFirstTime(studentName, resolvedLocation)
      : MESSAGES.studentNeedsHelpReturning(studentName, daysSinceLastAssistance, resolvedLocation);

  const notification = await createNotification(trainerId, title, body);

  // Real-time push so the trainer sees it immediately
  try {
    const { emitNotificationEvent } = await import("../realtime/ably.js");
    emitNotificationEvent({
      notificationId: notification.id,
      userId: trainerId,
      title,
      body,
      studentId: student.id,
      location: resolvedLocation,
      checkInAt,
      daysSinceLastAssistance,
      type: "STUDENT_ABANDONMENT_ALERT",
    });
  } catch (err) {
    logger.error("[communication.service] Failed to emit realtime notification:", err.message);
  }

  return notification;
}

// Combined helper: creates the in-app notification and, if an email is
// given, also sends it via Resend. Either side failing doesn't block the
// other (sendEmail already swallows its own errors; see above).
export async function notify(userId, message, email = null) {
  const notification = await createNotification(userId, message, "");

  if (email) {
    await sendEmail(email, message, `<p>${message}</p>`);
  }

  return notification;
}

// Grouped export so callers can do `communicationService.xyz(...)` (used by
// tests and by modules that prefer importing the whole service as one object).
export const communicationService = {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
  sendEmail,
  sendPasswordResetEmail,
  sendProgressEmail,
  notify,
  notifyTrainerOfReturningStudent,
};
