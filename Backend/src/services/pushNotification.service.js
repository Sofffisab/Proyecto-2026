import { firebase } from "../config/firebase.js";
import prisma from "../config/prisma.js";
import { logger } from "../utils/logger.js";

// Sends a "call-style" high-priority push (data-only, no `notification`
// block) so the frontend can draw its own full-screen, non-dismissible
// alert. Android uses high priority to wake the app; iOS uses background
// fetch + time-sensitive interruption to bypass Focus/DND.
export async function sendTrainerAlert({ trainerIds, type, payload }) {
  if (!firebase) {
    logger.warn("[push] Firebase not initialized — skipping trainer alert push");
    return { sent: 0, skipped: trainerIds.length };
  }

  const trainers = await prisma.user.findMany({
    where: { id: { in: trainerIds }, fcmToken: { not: null } },
    select: { id: true, fcmToken: true },
  });

  if (trainers.length === 0) {
    return { sent: 0, skipped: trainerIds.length };
  }

  const dataPayload = Object.fromEntries(
    Object.entries({ type, ...payload }).map(([k, v]) => [k, String(v)])
  );

  const message = {
    tokens: trainers.map((t) => t.fcmToken),
    data: dataPayload,
    android: {
      priority: "high",
      // Wakes the device / bypasses battery optimizations for this message.
      ttl: 60 * 1000,
    },
    apns: {
      headers: {
        "apns-priority": "10",
        "apns-push-type": "background",
      },
      payload: {
        aps: {
          "content-available": 1,
          "interruption-level": "time-sensitive",
        },
      },
    },
  };

  try {
    const response = await firebase.messaging().sendEachForMulticast(message);
    if (response.failureCount > 0) {
      response.responses.forEach((r, i) => {
        if (!r.success) {
          logger.warn(
            `[push] Failed to deliver to trainer ${trainers[i].id}:`,
            r.error?.message
          );
        }
      });
    }
    return { sent: response.successCount, skipped: response.failureCount };
  } catch (err) {
    logger.error("[push] sendTrainerAlert failed:", err.message);
    return { sent: 0, skipped: trainers.length };
  }
}
