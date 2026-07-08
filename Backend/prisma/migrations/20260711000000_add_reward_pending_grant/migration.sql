-- Tracks users who reached the points threshold for a reward while no
-- matching reward had stock, so admins have a "people waiting for
-- shipment" queue instead of the grant silently doing nothing.
-- See reward.service.js#autoGrantRewards / #fulfillPendingGrants.

-- CreateTable
CREATE TABLE "RewardPendingGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pointsAtQueueTime" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" TIMESTAMP(3),
    "fulfilledRedemptionId" TEXT,

    CONSTRAINT "RewardPendingGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RewardPendingGrant_userId_idx" ON "RewardPendingGrant"("userId");

-- CreateIndex
CREATE INDEX "RewardPendingGrant_fulfilledAt_idx" ON "RewardPendingGrant"("fulfilledAt");

-- CreateIndex
CREATE UNIQUE INDEX "RewardPendingGrant_fulfilledRedemptionId_key" ON "RewardPendingGrant"("fulfilledRedemptionId");

-- AddForeignKey
ALTER TABLE "RewardPendingGrant" ADD CONSTRAINT "RewardPendingGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardPendingGrant" ADD CONSTRAINT "RewardPendingGrant_fulfilledRedemptionId_fkey" FOREIGN KEY ("fulfilledRedemptionId") REFERENCES "RewardRedemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
