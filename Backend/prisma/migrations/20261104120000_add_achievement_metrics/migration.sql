-- New ways to earn achievements (the catalog rows themselves are created by
-- gamification.service.js#ensureAchievementCatalog).
ALTER TYPE "AchievementCategory" ADD VALUE IF NOT EXISTS 'TRAINER';
ALTER TYPE "AchievementMetric" ADD VALUE IF NOT EXISTS 'GYM_VISITS';
ALTER TYPE "AchievementMetric" ADD VALUE IF NOT EXISTS 'MACHINES_TRIED';
ALTER TYPE "AchievementMetric" ADD VALUE IF NOT EXISTS 'TRAINER_ASSISTANCES';
