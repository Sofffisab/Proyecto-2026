import prisma from "../config/prisma.js";
import { createNotification, sendEmail } from "./communication.service.js";
import { logger } from "../utils/logger.js";

// How long a goal can go with no meaningful progress before we recommend the
// user see a doctor or nutritionist, in addition to the regular in-app nudge.
const HEALTH_RECOMMENDATION_STALL_DAYS = parseInt(
  process.env.HEALTH_RECOMMENDATION_STALL_DAYS ?? "30",
  10
);
const HEALTH_RECOMMENDATION_LOW_PROGRESS_THRESHOLD = 20;

// Even users who are doing fine get a periodic preventive-health nudge
// (checkups, nutritionist, etc), independent of whether any goal is stalled.
const PREVENTIVE_HEALTH_REMINDER_DAYS = parseInt(
  process.env.PREVENTIVE_HEALTH_REMINDER_DAYS ?? "90",
  10
);

// Never email the same user about health more than once within this window,
// regardless of how many goals or checks would otherwise trigger it.
const HEALTH_EMAIL_COOLDOWN_DAYS = parseInt(
  process.env.HEALTH_EMAIL_COOLDOWN_DAYS ?? "14",
  10
);

export async function evaluateUserProgress(userId) {
  const goals = await prisma.goal.findMany({
    where: { userId, active: true },
    include: {
      progress: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  let shouldRecommendHealthProfessional = false;

  for (const goal of goals) {
    const lastEntry = goal.progress[0];
    const now = new Date();

    const daysSinceUpdate = lastEntry
      ? Math.floor((now - new Date(lastEntry.createdAt)) / (1000 * 60 * 60 * 24))
      : null;

    const progressPercent = lastEntry ? lastEntry.progressPercent : 0;

    if (daysSinceUpdate === null || daysSinceUpdate > 7) {
      await createNotification(
        userId,
        "Don't forget to log your progress",
        `You haven't updated your "${goal.type}" goal in ${daysSinceUpdate ?? "several"} days. Stay consistent!`
      );
    } else if (progressPercent < HEALTH_RECOMMENDATION_LOW_PROGRESS_THRESHOLD) {
      await createNotification(
        userId,
        "Your progress needs attention",
        `Your "${goal.type}" goal is at ${progressPercent.toFixed(0)}%. Consider adjusting your routine or consulting a trainer.`
      );
    }

    // A goal that's been open for a long time without meaningful progress is
    // the signal we use to recommend seeing a doctor or nutritionist — not
    // just an in-app reminder, since the person may not be checking the app.
    const daysSinceCreated = Math.floor((now - new Date(goal.createdAt)) / (1000 * 60 * 60 * 24));
    if (
      daysSinceCreated >= HEALTH_RECOMMENDATION_STALL_DAYS &&
      progressPercent < HEALTH_RECOMMENDATION_LOW_PROGRESS_THRESHOLD
    ) {
      shouldRecommendHealthProfessional = true;
    }
  }

  if (shouldRecommendHealthProfessional) {
    await maybeSendHealthRecommendationEmail(
      userId,
      "We noticed you haven't been reaching your goals",
      "It looks like one or more of your goals haven't shown much progress in a while. " +
        "This can happen for lots of reasons, and it might help to check in with a doctor " +
        "or nutritionist to see if there's anything getting in the way, or to adjust your plan."
    );
  } else {
    await maybeSendPreventiveHealthEmail(userId);
  }
}

/**
 * Sends a preventive-health email to users who haven't received one recently,
 * even if their goals are on track — regular checkups are good practice
 * regardless of progress.
 */
async function maybeSendPreventiveHealthEmail(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastHealthEmailAt: true },
  });

  if (!user) return;

  const now = new Date();
  const daysSinceLastEmail = user.lastHealthEmailAt
    ? Math.floor((now - new Date(user.lastHealthEmailAt)) / (1000 * 60 * 60 * 24))
    : null;

  if (daysSinceLastEmail !== null && daysSinceLastEmail < PREVENTIVE_HEALTH_REMINDER_DAYS) {
    return;
  }

  await maybeSendHealthRecommendationEmail(
    userId,
    "A friendly reminder about preventive health",
    "As part of taking care of yourself, it's a good idea to schedule a routine checkup " +
      "with a doctor or nutritionist every so often, even when things are going well."
  );
}

/**
 * Shared sender for both the "stalled goal" and "preventive" health emails.
 * Enforces the cooldown so a user is never emailed about health more than
 * once within HEALTH_EMAIL_COOLDOWN_DAYS, regardless of which path triggered it.
 */
async function maybeSendHealthRecommendationEmail(userId, subject, message) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, firstName: true, lastHealthEmailAt: true },
  });

  if (!user) return;

  const now = new Date();
  const daysSinceLastEmail = user.lastHealthEmailAt
    ? Math.floor((now - new Date(user.lastHealthEmailAt)) / (1000 * 60 * 60 * 24))
    : null;

  if (daysSinceLastEmail !== null && daysSinceLastEmail < HEALTH_EMAIL_COOLDOWN_DAYS) {
    return;
  }

  await createNotification(userId, subject, message);
  await sendEmail(
    user.email,
    subject,
    `<p>Hi ${user.firstName},</p><p>${message}</p><p>This is an automated suggestion, not a medical diagnosis — please consult a qualified professional.</p>`
  );

  await prisma.user.update({
    where: { id: userId },
    data: { lastHealthEmailAt: now },
  });
}

export async function runSuggestionEngineForAll() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  for (const user of users) {
    try {
      await evaluateUserProgress(user.id);
    } catch (err) {
      logger.error(`[suggestionEngine] Failed for user ${user.id}:`, err.message);
    }
  }
}