import prisma from "../config/prisma.js";
import { logger } from "../utils/logger.js";
import { isBirthdayToday } from "../utils/age.js";
import { sendBirthdayEmail } from "../services/communication.service.js";

/**
 * Runs daily. Finds every active user whose birthday is today and who
 * hasn't already been congratulated this year (throttled via
 * lastBirthdayEmailAt, same pattern as lastHealthEmailAt), sends them a
 * congratulation email + in-app notification, and stamps the throttle.
 *
 * Note: we never store/patch an "age" field here. Age is always derived
 * on read from `birthday` (see utils/age.js / user.service.js). This job's
 * only job is the once-a-year congratulation side effect.
 */
export async function sendBirthdayGreetings() {
  const now = new Date();
  const currentYear = now.getFullYear();

  // Birthday month/day can't be filtered directly in SQL via Prisma without
  // raw queries, so we narrow with a cheap "has a birthday set" filter and
  // do the month/day (and leap-year) match in JS via isBirthdayToday().
  const candidates = await prisma.user.findMany({
    where: { isActive: true, birthday: { not: null } },
    select: { id: true, email: true, firstName: true, birthday: true, lastBirthdayEmailAt: true },
  });

  const todaysBirthdays = candidates.filter((user) => {
    if (!isBirthdayToday(user.birthday, now)) return false;
    const alreadyGreetedThisYear =
      user.lastBirthdayEmailAt && new Date(user.lastBirthdayEmailAt).getFullYear() === currentYear;
    return !alreadyGreetedThisYear;
  });

  if (todaysBirthdays.length === 0) {
    logger.info("[birthday.job] No birthdays today.");
    return;
  }

  for (const user of todaysBirthdays) {
    try {
      await sendBirthdayEmail(user.email, user.firstName, user.id);
      await prisma.user.update({
        where: { id: user.id },
        data: { lastBirthdayEmailAt: now },
      });
    } catch (err) {
      // One failed user shouldn't stop the rest from being greeted.
      logger.error(`[birthday.job] Failed to greet user ${user.id}: ${err.message}`);
    }
  }

  logger.info(`[birthday.job] Sent ${todaysBirthdays.length} birthday greeting(s).`);
}
