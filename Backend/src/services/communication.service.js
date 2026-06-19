import { Resend } from "resend";
import prisma from "../config/prisma.js";

const resend = new Resend(process.env.RESEND_API_KEY);

// ============================================
// IN-APP NOTIFICATIONS (database)
// ============================================

/**
 * Crea una notificación in-app en la base de datos.
 * @param {string} userId
 * @param {string} title
 * @param {string} body
 */
export async function createNotification(userId, title, body) {
  return prisma.notification.create({
    data: { userId, title, body },
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

export async function markAsRead(notificationId) {
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

export async function deleteNotification(id) {
  return prisma.notification.delete({ where: { id } });
}

export async function getUnreadCount(userId) {
  return prisma.notification.count({ where: { userId, read: false } });
}

// ============================================
// EMAIL (Resend)
// ============================================

/**
 * Envía un email transaccional via Resend.
 * @param {string} to
 * @param {string} subject
 * @param {string} html
 */
export async function sendEmail(to, subject, html) {
  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to,
    subject,
    html,
  });
}

export async function sendWelcomeEmail(user) {
  return sendEmail(
    user.email,
    "Bienvenido al Gym App",
    `<h1>Hola ${user.firstName}</h1><p>Bienvenido a nuestra plataforma. ¡A entrenar!</p>`
  );
}

export async function sendPasswordResetEmail(user, resetToken) {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  return sendEmail(
    user.email,
    "Recuperar contraseña",
    `<p>Hacé clic en el siguiente link para resetear tu contraseña (válido por 1 hora):</p>
     <a href="${resetUrl}">${resetUrl}</a>`
  );
}

export async function sendProgressEmail(user, message) {
  return sendEmail(
    user.email,
    "Actualización de progreso",
    `<p>${message}</p>`
  );
}

// ============================================
// COMBINED — in-app + email together
// ============================================

/**
 * Notifica al usuario tanto in-app como por email.
 * @param {{ id: string, email: string }} user
 * @param {string} title
 * @param {string} body
 */
export async function notify(user, title, body) {
  await createNotification(user.id, title, body);
  await sendEmail(user.email, title, `<p>${body}</p>`);
}