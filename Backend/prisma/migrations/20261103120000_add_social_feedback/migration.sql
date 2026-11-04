-- CreateTable: feedback after a completed social interaction
CREATE TABLE "SocialFeedback" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER,
    "liked" BOOLEAN,
    "reported" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocialFeedback_challengeId_userId_key" ON "SocialFeedback"("challengeId", "userId");

-- CreateIndex
CREATE INDEX "SocialFeedback_userId_idx" ON "SocialFeedback"("userId");

-- AddForeignKey
ALTER TABLE "SocialFeedback" ADD CONSTRAINT "SocialFeedback_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "SocialChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialFeedback" ADD CONSTRAINT "SocialFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
