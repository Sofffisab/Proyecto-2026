import prisma from "../config/prisma.js";
import { generateWrapped } from "../services/wrapped.service.js";

export async function generateAnnualWrapped(year) {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  let processed = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await generateWrapped(user.id, year);
      processed++;
    } catch (err) {
      // A single user failure must not abort the rest of the batch
      console.error(`[wrapped.job] Failed for user ${user.id}:`, err.message);
      failed++;
    }
  }

  console.log(`[wrapped.job] Done — ${processed} processed, ${failed} failed`);
}