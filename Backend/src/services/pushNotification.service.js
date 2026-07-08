import { firebase } from "../config/firebase.js";
import prisma from "../config/prisma.js";
import { logger } from "../utils/logger.js";

/**
 * Sends a "call-style" high priority push notification.
 *
 * IMPORTANT: this is intentionally a DATA-ONLY message (no `notification`
 * block). If we included a `notification` block, Android/iOS would render
 * the OS's own transient banner and the frontend would never get a chance
 * to intercept it and draw the full-screen blocking UI. By sending only
 * `data`, the message is delivered to our own background handler
 * (see Frontend `src/services/sos.service.js`), which is what lets us:
 *   - show a full-screen, non-dismissible screen (Uber/Cabify style)
 *   - keep it ringing until the trainer taps "Ayudar" or "Cerrar"
 *
 * On Android we ask for `priority: "high"` so the OS wakes the app process
 * even if it's backgrounded/killed. On iOS we set `content-available: 1`
 * (background fetch) plus `interruption-level: time-sensitive` so it can
 * bypass Focus/Do Not Disturb the same way a VoIP-style alert would.
 */
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
