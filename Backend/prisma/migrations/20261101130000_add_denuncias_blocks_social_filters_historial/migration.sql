-- CreateEnum
CREATE TYPE "DenunciaType" AS ENUM ('TRAINER_MISCONDUCT', 'TRAINER_FALSE_HELP', 'MACHINE_BROKEN', 'MEMBER_MISCONDUCT');

-- CreateEnum
CREATE TYPE "DenunciaStatus" AS ENUM ('PENDING', 'REVIEWED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "HistorialTipo" AS ENUM ('GYM_CHECK_IN', 'GYM_CHECK_OUT', 'MACHINE_USE', 'TRAINER_ASSISTANCE', 'SOCIAL_INTERACTION');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "profilePhoto" TEXT;

-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN "socialSameGenderOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "socialSameAgeRangeOnly" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "GymSession" ADD COLUMN "dayRating" INTEGER;

-- CreateTable
CREATE TABLE "denuncias" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "gymSessionId" TEXT,
    "type" "DenunciaType" NOT NULL,
    "reportedUserId" TEXT,
    "machineId" TEXT,
    "comment" TEXT,
    "status" "DenunciaStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "denuncias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBlock" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" "HistorialTipo" NOT NULL,
    "otherUserId" TEXT,
    "machineId" TEXT,
    "gymSessionId" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "denuncias_reporterId_idx" ON "denuncias"("reporterId");

-- CreateIndex
CREATE INDEX "denuncias_reportedUserId_idx" ON "denuncias"("reportedUserId");

-- CreateIndex
CREATE INDEX "denuncias_machineId_idx" ON "denuncias"("machineId");

-- CreateIndex
CREATE INDEX "denuncias_status_idx" ON "denuncias"("status");

-- CreateIndex
CREATE INDEX "denuncias_gymSessionId_idx" ON "denuncias"("gymSessionId");

-- CreateIndex
CREATE INDEX "UserBlock_blockerId_idx" ON "UserBlock"("blockerId");

-- CreateIndex
CREATE INDEX "UserBlock_blockedId_idx" ON "UserBlock"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBlock_blockerId_blockedId_key" ON "UserBlock"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "historial_userId_occurredAt_idx" ON "historial"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "historial_tipo_idx" ON "historial"("tipo");

-- AddForeignKey
ALTER TABLE "denuncias" ADD CONSTRAINT "denuncias_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "denuncias" ADD CONSTRAINT "denuncias_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "denuncias" ADD CONSTRAINT "denuncias_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "denuncias" ADD CONSTRAINT "denuncias_gymSessionId_fkey" FOREIGN KEY ("gymSessionId") REFERENCES "GymSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial" ADD CONSTRAINT "historial_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial" ADD CONSTRAINT "historial_otherUserId_fkey" FOREIGN KEY ("otherUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
