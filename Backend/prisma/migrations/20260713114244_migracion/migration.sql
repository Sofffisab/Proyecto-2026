/*
  Warnings:

  - The values [PENDING,APPROVED,REJECTED] on the enum `RewardRedemptionStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `approvedAt` on the `RewardRedemption` table. All the data in the column will be lost.
  - You are about to drop the column `approvedBy` on the `RewardRedemption` table. All the data in the column will be lost.
  - You are about to drop the column `reviewedAt` on the `RewardRedemption` table. All the data in the column will be lost.
  - You are about to drop the column `reviewedBy` on the `RewardRedemption` table. All the data in the column will be lost.
  - You are about to drop the column `shippedAt` on the `RewardRedemption` table. All the data in the column will be lost.
  - You are about to drop the column `lastBirthdayEmailAt` on the `User` table. All the data in the column will be lost.
  - Made the column `firstName` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `lastName` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "MachineConflictResolution" AS ENUM ('BOTH_PRESENT', 'NEITHER_PRESENT', 'ONLY_FIRST', 'ONLY_SECOND', 'UNVERIFIED');

-- AlterEnum
ALTER TYPE "ComplaintSource" ADD VALUE 'AUTO_MACHINE_CONFLICT';

-- AlterEnum
BEGIN;
CREATE TYPE "RewardRedemptionStatus_new" AS ENUM ('SHIPPED', 'DELIVERED');
ALTER TABLE "public"."RewardRedemption" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "RewardRedemption" ALTER COLUMN "status" TYPE "RewardRedemptionStatus_new" USING ("status"::text::"RewardRedemptionStatus_new");
ALTER TYPE "RewardRedemptionStatus" RENAME TO "RewardRedemptionStatus_old";
ALTER TYPE "RewardRedemptionStatus_new" RENAME TO "RewardRedemptionStatus";
DROP TYPE "public"."RewardRedemptionStatus_old";
ALTER TABLE "RewardRedemption" ALTER COLUMN "status" SET DEFAULT 'SHIPPED';
COMMIT;

-- AlterTable
ALTER TABLE "RewardRedemption" DROP COLUMN "approvedAt",
DROP COLUMN "approvedBy",
DROP COLUMN "reviewedAt",
DROP COLUMN "reviewedBy",
DROP COLUMN "shippedAt",
ALTER COLUMN "status" SET DEFAULT 'SHIPPED';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "lastBirthdayEmailAt",
ALTER COLUMN "firstName" SET NOT NULL,
ALTER COLUMN "lastName" SET NOT NULL,
ALTER COLUMN "objectives" DROP DEFAULT;

-- CreateTable
CREATE TABLE "MachineConflict" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "firstUserId" TEXT NOT NULL,
    "secondUserId" TEXT NOT NULL,
    "firstUsageId" TEXT NOT NULL,
    "secondUsageId" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedTrainers" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolution" "MachineConflictResolution",

    CONSTRAINT "MachineConflict_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MachineConflict_machineId_idx" ON "MachineConflict"("machineId");

-- CreateIndex
CREATE INDEX "MachineConflict_resolvedAt_idx" ON "MachineConflict"("resolvedAt");

-- AddForeignKey
ALTER TABLE "MachineConflict" ADD CONSTRAINT "MachineConflict_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineConflict" ADD CONSTRAINT "MachineConflict_firstUserId_fkey" FOREIGN KEY ("firstUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineConflict" ADD CONSTRAINT "MachineConflict_secondUserId_fkey" FOREIGN KEY ("secondUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineConflict" ADD CONSTRAINT "MachineConflict_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
