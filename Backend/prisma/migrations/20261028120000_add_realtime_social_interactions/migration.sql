-- AlterTable: real-time social interaction pop-up flow
ALTER TABLE "SocialChallenge"
  ADD COLUMN "isRealtime" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "userAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "partnerAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "pairedAt" TIMESTAMP(3),
  ADD COLUMN "qrHolderId" TEXT,
  ADD COLUMN "cancelledById" TEXT;

-- CreateIndex
CREATE INDEX "SocialChallenge_status_expiresAt_idx" ON "SocialChallenge"("status", "expiresAt");
