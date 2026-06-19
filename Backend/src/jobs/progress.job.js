// src/jobs/progress.job.js
import prisma from "../config/prisma.js";
import { runSuggestionEngineForAll } from "../services/suggestionEngine.service.js";

export async function checkInactiveProgress() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  for (const user of users) {
    try {
      const lastProgress = await prisma.progressEntry.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });

      if (!lastProgress) {
        console.log(`[progressJob] User ${user.id} has no progress entries.`);
      }
    } catch (err) {
      console.error(`[progressJob] Failed for user ${user.id}:`, err.message);
    }
  }

  await runSuggestionEngineForAll();
  console.log("[progressJob] Suggestion engine run complete.");
}