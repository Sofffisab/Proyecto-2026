-- Track a single in-flight push alert per trainer, so a trainer already
-- holding an unresolved alert doesn't get a second one until it resolves.
ALTER TABLE "TrainerProfile" ADD COLUMN "pendingAlertAssistanceId" TEXT;
ALTER TABLE "TrainerProfile" ADD COLUMN "pendingAlertAt" TIMESTAMP(3);
