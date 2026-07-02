-- AlterTable
ALTER TABLE "User" ADD COLUMN "fcmToken" TEXT;

-- AlterTable
ALTER TABLE "SocialChallenge" ADD COLUMN "completedAt" TIMESTAMP(3);
