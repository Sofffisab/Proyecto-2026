import { sendPushAndNotification } from "../features/notifications.js";
import cron from "node-cron";
import { prisma } from "../prisma/prisma.js";
import { addDays, generateQRCodeString, subMinutes } from "./utils.js";
import QRCode from "qrcode";

// ============ QR REGENERATION CRON ============

export const setupQRCron = () => {
  cron.schedule("0 * * * *", async () => {
    try {
      const now = new Date();

      const qrCodesToRegenerate = await prisma.qRCode.findMany({
        where: {
          isValid: true,
          OR: [
            { expiresAt: { lte: now } },
            {
              regenerationSchedule: { not: null },
              nextRegenerationAt: { lte: now },
            },
          ],
        },
      });

      for (const qrCode of qrCodesToRegenerate) {
        try {
          const newCode = generateQRCodeString();
          const newImage = await QRCode.toDataURL(newCode);
          const newExpiresAt = qrCode.type === "machine" ? addDays(now, 30) : addDays(now, 1);

          await prisma.qRCode.update({
            where: { id: qrCode.id },
            data: {
              code: newCode,
              image: newImage,
              expiresAt: newExpiresAt,
              nextRegenerationAt: newExpiresAt,
              isValid: true,
            },
          });
        } catch (err) {
          console.error(`[CRON] Failed to regenerate QR ${qrCode.id}:`, err);
        }
      }

      if (qrCodesToRegenerate.length > 0) {
        console.log(`[CRON] Regenerated ${qrCodesToRegenerate.length} QR codes`);
      }
    } catch (error) {
      console.error("[CRON] QR regeneration error:", error);
    }
  });

  console.log("[CRON] QR regeneration cron scheduled");
};

// ============ STATS CRON ============

export const setupStatsCron = () => {
  cron.schedule("0 0 * * *", async () => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [checkInsCount, helpRequestsCount, progressUpdatesCount, newUsersCount] =
        await Promise.all([
          prisma.checkIn.count({
            where: {
              entryTime: { gte: yesterday, lt: today },
            },
          }),
          prisma.helpRequest.count({
            where: {
              createdAt: { gte: yesterday, lt: today },
            },
          }),
          prisma.progressUpdate.count({
            where: {
              createdAt: { gte: yesterday, lt: today },
            },
          }),
          prisma.user.count({
            where: {
              createdAt: { gte: yesterday, lt: today },
            },
          }),
        ]);

      await prisma.adminReport.create({
        data: {
          reportType: "daily_stats",
          data: {
            date: yesterday.toISOString().split("T")[0],
            checkIns: checkInsCount,
            helpRequests: helpRequestsCount,
            progressUpdates: progressUpdatesCount,
            newUsers: newUsersCount,
          },
          generatedAt: new Date(),
        },
      });

      console.log(
        `[CRON] Daily stats generated: ${checkInsCount} check-ins, ${newUsersCount} new users`
      );
    } catch (error) {
      console.error("[CRON] Stats cron error:", error);
    }
  });

  console.log("[CRON] Stats cron scheduled");
};

// ============ CLEANUP CRON ============

export const setupCleanupCron = () => {
  cron.schedule("*/30 * * * *", async () => {
    try {
      const thirtyMinutesAgo = subMinutes(new Date(), 30);

      const abandonedUsages = await prisma.machineUsage.findMany({
        where: {
          endTime: null,
          startTime: { lte: thirtyMinutesAgo },
        },
        select: { id: true, machineId: true },
      });

      if (abandonedUsages.length > 0) {
        const abandonedIds = abandonedUsages.map((u) => u.id);
        const abandonedMachineIds = [...new Set(abandonedUsages.map((u) => u.machineId))];

        await prisma.$transaction([
          prisma.machineUsage.updateMany({
            where: { id: { in: abandonedIds } },
            data: { endTime: new Date() },
          }),
          prisma.machine.updateMany({
            where: { id: { in: abandonedMachineIds } },
            data: { status: "available" },
          }),
        ]);

        console.log(
          `[CRON] Closed ${abandonedUsages.length} abandoned machine usages and freed ${abandonedMachineIds.length} machines`
        );
      }

      const expiredQRs = await prisma.qRCode.updateMany({
        where: {
          isValid: true,
          expiresAt: { lte: new Date() },
        },
        data: { isValid: false },
      });

      if (expiredQRs.count > 0) {
        console.log(`[CRON] Invalidated ${expiredQRs.count} expired QR codes`);
      }
    } catch (error) {
      console.error("[CRON] Cleanup cron error:", error);
    }
  });

  console.log("[CRON] Cleanup cron scheduled");
};

// ============ REMINDERS CRON ============

export const setupRemindersCron = () => {
  cron.schedule("0 * * * *", async () => {
    try {
      const now = new Date();
      const currentHour = String(now.getHours()).padStart(2, "0");
      const currentMinute = String(now.getMinutes()).padStart(2, "0");
      const currentTime = `${currentHour}:${currentMinute}`;

      const routinesWithReminders = await prisma.userRoutine.findMany({
        where: {
          remindersEnabled: true,
          reminderTime: {
            startsWith: currentHour,
          },
        },
        include: {
          user: {
            select: { id: true, pushToken: true },
          },
        },
      });

      for (const routine of routinesWithReminders) {
        if (routine.reminderTime === currentTime) {
          try {
            await sendPushAndNotification(
              routine.userId,
              "reminder",
              "Workout Reminder",
              `Time for your workout: ${routine.name}`,
              { routineId: routine.id }
            );
          } catch (err) {
            console.error(`[CRON] Failed to send reminder for routine ${routine.id}:`, err);
          }
        }
      }
    } catch (error) {
      console.error("[CRON] Reminders cron error:", error);
    }
  });

  console.log("[CRON] Reminders cron scheduled");
};