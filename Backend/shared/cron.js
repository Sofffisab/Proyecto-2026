import cron from "node-cron";
import { prisma } from "../prisma/prisma.js";
import { regenerateQRCode } from "../features/qr.js";
import { sendPushAndNotification } from "../features/notifications.js";
import { NOTIFICATION_TYPES, addDays, subMinutes } from "./utils.js";

// ============ QR CRON ============
export const setupQRCron = () => {
  // Regenerate QR codes every day at 2 AM
  cron.schedule("0 2 * * *", async () => {
    try {
      console.log("[CRON] Starting QR code regeneration");

      const qrCodes = await prisma.qRCode.findMany({
        where: {
          isValid: true,
          regenerationSchedule: { not: null },
          nextRegenerationAt: { lte: new Date() },
        },
      });

      for (const qrCode of qrCodes) {
        await regenerateQRCode(qrCode.id);
        console.log(`[CRON] Regenerated QR code: ${qrCode.id}`);
      }

      console.log(`[CRON] QR code regeneration completed. Regenerated ${qrCodes.length} codes`);
    } catch (error) {
      console.error("[CRON] QR regeneration failed:", error);
    }
  });
};

// ============ STATS CRON ============
export const setupStatsCron = () => {
  // Daily stats report at 23:59
  cron.schedule("59 23 * * *", async () => {
    try {
      console.log("[CRON] Generating daily stats report");

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const checkIns = await prisma.checkIn.count({
        where: {
          entryTime: { gte: todayStart, lte: todayEnd },
        },
      });

      const newUsers = await prisma.user.count({
        where: {
          createdAt: { gte: todayStart, lte: todayEnd },
        },
      });

      const totalActiveUsers = await prisma.checkIn.groupBy({
        by: ["userId"],
        where: {
          entryTime: { gte: todayStart, lte: todayEnd },
        },
      });

      const report = await prisma.adminReport.create({
        data: {
          reportType: "daily_summary",
          data: {
            date: new Date().toISOString().split("T")[0],
            checkIns,
            newUsers,
            activeUsers: totalActiveUsers.length,
          },
        },
      });

      console.log(`[CRON] Daily report generated: ${report.id}`);
    } catch (error) {
      console.error("[CRON] Daily stats generation failed:", error);
    }
  });

  // Weekly stats report on Sunday at 23:59
  cron.schedule("59 23 * * 0", async () => {
    try {
      console.log("[CRON] Generating weekly stats report");

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const checkIns = await prisma.checkIn.count({
        where: { entryTime: { gte: weekAgo } },
      });

      const machines = await prisma.machine.findMany();
      const machineStats = [];

      for (const machine of machines) {
        const usageCount = await prisma.checkIn.count({
          where: { machineId: machine.id, entryTime: { gte: weekAgo } },
        });
        machineStats.push({ machineId: machine.id, usage: usageCount });
      }

      const report = await prisma.adminReport.create({
        data: {
          reportType: "weekly_summary",
          data: {
            week: new Date().toISOString().split("T")[0],
            totalCheckIns: checkIns,
            machineStats,
          },
        },
      });

      console.log(`[CRON] Weekly report generated: ${report.id}`);
    } catch (error) {
      console.error("[CRON] Weekly stats generation failed:", error);
    }
  });
};

// ============ CLEANUP CRON ============
export const setupCleanupCron = () => {
  // Cleanup at 3 AM daily
  cron.schedule("0 3 * * *", async () => {
    try {
      console.log("[CRON] Starting cleanup tasks");

      // Delete old read notifications (older than 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const deletedNotifications = await prisma.userNotification.deleteMany({
        where: {
          isRead: true,
          readAt: { lte: thirtyDaysAgo },
        },
      });

      console.log(`[CRON] Deleted ${deletedNotifications.count} old notifications`);

      // Invalidate old QR scan logs (older than 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const deletedLogs = await prisma.qRScanLog.deleteMany({
        where: { scannedAt: { lte: ninetyDaysAgo } },
      });

      console.log(`[CRON] Deleted ${deletedLogs.count} old QR scan logs`);

      // Archive old reports (older than 180 days)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);

      const archivedReports = await prisma.adminReport.updateMany({
        where: { generatedAt: { lte: sixMonthsAgo } },
        data: { archived: true },
      });

      console.log(`[CRON] Archived ${archivedReports.count} old reports`);

      console.log("[CRON] Cleanup tasks completed");
    } catch (error) {
      console.error("[CRON] Cleanup tasks failed:", error);
    }
  });
};

// ============ REMINDERS CRON ============
export const setupRemindersCron = () => {
  // Check for routine reminders every minute
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}`;

      const routines = await prisma.userRoutine.findMany({
        where: {
          remindersEnabled: true,
          reminderTime: currentTime,
        },
        include: { user: { select: { id: true } } },
      });

      for (const routine of routines) {
        await sendPushAndNotification(
          routine.user.id,
          NOTIFICATION_TYPES.REMINDER,
          "Routine Reminder",
          `Time to do your routine: ${routine.name}`,
          { routineId: routine.id, routineName: routine.name }
        );
      }

      if (routines.length > 0) {
        console.log(`[CRON] Sent ${routines.length} routine reminders`);
      }
    } catch (error) {
      console.error("[CRON] Routine reminders failed:", error);
    }
  });

  // Check for stale help requests every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      const fiveMinutesAgo = subMinutes(new Date(), 5);

      const staleRequests = await prisma.helpRequest.findMany({
        where: {
          status: "pending",
          requestedAt: { lte: fiveMinutesAgo },
        },
        include: {
          user: { select: { id: true, fullName: true } },
        },
      });

      for (const request of staleRequests) {
        await sendPushAndNotification(
          request.user.id,
          NOTIFICATION_TYPES.HELP_CALLED,
          "Help Status",
          "Your help request is still pending. A trainer will assist you soon.",
          { helpRequestId: request.id }
        );
      }

      if (staleRequests.length > 0) {
        console.log(`[CRON] Notified users about ${staleRequests.length} stale help requests`);
      }
    } catch (error) {
      console.error("[CRON] Stale help request check failed:", error);
    }
  });

  // Check for expired pending progress updates every hour
  cron.schedule("0 * * * *", async () => {
    try {
      const oneDayAgo = addDays(new Date(), -1);

      const expiredProgress = await prisma.progressUpdate.findMany({
        where: {
          status: "pending",
          createdAt: { lte: oneDayAgo },
        },
      });

      for (const progress of expiredProgress) {
        await prisma.progressUpdate.update({
          where: { id: progress.id },
          data: {
            status: "denied",
            feedback: "Request expired due to no verification",
          },
        });

        await sendPushAndNotification(
          progress.userId,
          NOTIFICATION_TYPES.PROGRESS_DENIED,
          "Progress Request Expired",
          "Your progress verification request has expired",
          { progressId: progress.id }
        );
      }

      if (expiredProgress.length > 0) {
        console.log(`[CRON] Expired ${expiredProgress.length} pending progress updates`);
      }
    } catch (error) {
      console.error("[CRON] Progress expiration check failed:", error);
    }
  });
};