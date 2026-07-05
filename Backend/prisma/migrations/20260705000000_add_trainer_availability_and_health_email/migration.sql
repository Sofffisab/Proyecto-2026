-- CreateEnum
CREATE TYPE "TrainerAvailabilityStatus" AS ENUM ('AVAILABLE', 'BUSY');

-- AlterTable: TrainerProfile gets an availability flag so the backend never
-- assigns a trainer who is already dictating a class / helping someone else.
ALTER TABLE "TrainerProfile" ADD COLUMN "availability" "TrainerAvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE "TrainerProfile" ADD COLUMN "availabilityUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: User gets a timestamp to throttle preventive health-recommendation emails.
ALTER TABLE "User" ADD COLUMN "lastHealthEmailAt" TIMESTAMP(3);
