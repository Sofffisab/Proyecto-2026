-- Add autoClosed flag to GymSession so an automatic (cron) checkout can be
-- distinguished from a real user-scanned checkout. When a user's real exit
-- scan arrives after an auto-close, it overwrites the auto-closed data.
ALTER TABLE "GymSession" ADD COLUMN "autoClosed" BOOLEAN NOT NULL DEFAULT false;
