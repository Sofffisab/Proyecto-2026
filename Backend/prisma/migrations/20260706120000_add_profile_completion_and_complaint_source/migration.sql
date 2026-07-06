-- User: mandatory-profile lock. Regular members are blocked from the rest
-- of the API by requireCompleteProfile middleware until this is true.
ALTER TABLE "User" ADD COLUMN "isProfileComplete" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing users: mark complete if they already have the
-- required fields (birthday, medicalConditions, deliveryAddress) filled in,
-- so pre-existing accounts aren't suddenly locked out after deploy.
UPDATE "User"
SET "isProfileComplete" = true
WHERE "birthday" IS NOT NULL
  AND "medicalConditions" IS NOT NULL
  AND "deliveryAddress" IS NOT NULL;

-- Complaint: distinguish who/what originated the complaint (regular user
-- report, trainer report against a member, or system auto-generated report
-- from the "No me ayudaron" flow) and link it to the gym session it came
-- from, when applicable.
CREATE TYPE "ComplaintSource" AS ENUM ('USER', 'TRAINER_REPORT', 'AUTO_NO_HELP');

ALTER TABLE "Complaint" ADD COLUMN "source" "ComplaintSource" NOT NULL DEFAULT 'USER';
ALTER TABLE "Complaint" ADD COLUMN "gymSessionId" TEXT;

ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_gymSessionId_fkey"
  FOREIGN KEY ("gymSessionId") REFERENCES "GymSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Complaint_gymSessionId_idx" ON "Complaint"("gymSessionId");
