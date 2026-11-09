-- Admin / Trainer backend: report escalation, routine proposals, prize
-- stock/pause, activity log, per-account routines and assistance details.

-- Enum values (each used only after this migration commits)
ALTER TYPE "ComplaintStatus" ADD VALUE IF NOT EXISTS 'ESCALATED';
ALTER TYPE "DenunciaStatus" ADD VALUE IF NOT EXISTS 'ESCALATED';
ALTER TYPE "RoutineRequestStatus" ADD VALUE IF NOT EXISTS 'PROPOSED';
ALTER TYPE "RoutineRequestStatus" ADD VALUE IF NOT EXISTS 'DECLINED';

-- Complaint / Denuncia review data
ALTER TABLE "Complaint" ADD COLUMN "penaltyPoints" INTEGER;
ALTER TABLE "denuncias" ADD COLUMN "reviewedBy" TEXT;
ALTER TABLE "denuncias" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "denuncias" ADD COLUMN "penaltyPoints" INTEGER;

-- Rewards: total ever stocked + the prize being handed out now
ALTER TABLE "Reward" ADD COLUMN "totalStock" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Reward" ADD COLUMN "isCurrent" BOOLEAN NOT NULL DEFAULT false;
-- Existing rewards: units still in stock + units already shipped
UPDATE "Reward" r
SET "totalStock" = r."stock" + COALESCE((SELECT COUNT(*) FROM "RewardRedemption" rr WHERE rr."rewardId" = r."id"), 0);

-- Assistance details
ALTER TABLE "Assistance" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Assistance" ADD COLUMN "machineId" TEXT;
ALTER TABLE "Assistance" ADD CONSTRAINT "Assistance_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Routine requests: the routine a trainer proposes and the member's answer
ALTER TABLE "RoutineRequest" ADD COLUMN "proposedName" TEXT;
ALTER TABLE "RoutineRequest" ADD COLUMN "proposedExercises" JSONB;
ALTER TABLE "RoutineRequest" ADD COLUMN "proposedAt" TIMESTAMP(3);
ALTER TABLE "RoutineRequest" ADD COLUMN "respondedAt" TIMESTAMP(3);
ALTER TABLE "RoutineRequest" ADD COLUMN "generalRoutineId" TEXT;

-- General routines can now belong to a single account
ALTER TABLE "GeneralRoutine" ADD COLUMN "ownerUserId" TEXT;
ALTER TABLE "GeneralRoutine" ADD COLUMN "createdByTrainerId" TEXT;
CREATE INDEX "GeneralRoutine_ownerUserId_idx" ON "GeneralRoutine"("ownerUserId");
ALTER TABLE "GeneralRoutine" ADD CONSTRAINT "GeneralRoutine_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Global gym switches (single row)
CREATE TABLE "GymSettings" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "rewardDeliveriesPaused" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GymSettings_pkey" PRIMARY KEY ("id")
);

-- Audit trail (insert-only)
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");
CREATE INDEX "ActivityLog_actorId_idx" ON "ActivityLog"("actorId");
CREATE INDEX "ActivityLog_action_idx" ON "ActivityLog"("action");
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
