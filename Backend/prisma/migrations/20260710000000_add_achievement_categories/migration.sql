-- Personal achievement badges by category (consistency streaks, social
-- interactions, machine usage) on top of the existing points-based ones.
-- See gamification.service.js#checkAndUnlockAchievements and
-- achievementMetrics.service.js.

-- CreateEnum
CREATE TYPE "AchievementCategory" AS ENUM ('CONSISTENCY', 'SOCIAL', 'MACHINE', 'POINTS');

-- CreateEnum
CREATE TYPE "AchievementMetric" AS ENUM ('STREAK_DAYS', 'STREAK_WEEKS', 'STREAK_MONTHS', 'SOCIAL_INTERACTIONS', 'MACHINE_USES', 'TOTAL_POINTS');

-- AlterTable
-- pointsRequired becomes optional-in-spirit (kept NOT NULL with a default
-- of 0) since it's now only meaningful for metric = TOTAL_POINTS.
ALTER TABLE "Achievement" ALTER COLUMN "pointsRequired" SET DEFAULT 0;
ALTER TABLE "Achievement" ADD COLUMN "category" "AchievementCategory" NOT NULL DEFAULT 'POINTS';
ALTER TABLE "Achievement" ADD COLUMN "metric" "AchievementMetric" NOT NULL DEFAULT 'TOTAL_POINTS';
ALTER TABLE "Achievement" ADD COLUMN "threshold" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Achievement_category_idx" ON "Achievement"("category");
