import { prisma } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { isBirthdayToday } from "../utils/age.js";
import { sendBirthdayEmail } from "../services/communication.service.js";

/**
 * Daily: greets every active user whose birthday is today and hasn't been
 * congratulated yet this year (throttled via lastBirthdayEmailAt). Age is
 * never stored — always derived on read from `birthday` (see utils/age.js).
 */
export async function sendBirthdayGreetings() {
  const now = new Date();
  const currentYear = now.getFullYear();

  // Month/day matching can't be done directly in SQL via Prisma, so we
  // narrow with a cheap "has birthday set" filter and match in JS below
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
