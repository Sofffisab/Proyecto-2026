-- CreateEnum
CREATE TYPE "TrainerNoteVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- AlterTable
ALTER TABLE "TrainerNote" ADD COLUMN "visibility" "TrainerNoteVisibility" NOT NULL DEFAULT 'PRIVATE';
