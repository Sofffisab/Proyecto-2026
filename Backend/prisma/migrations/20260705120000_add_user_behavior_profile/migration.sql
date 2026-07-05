-- CreateTable: caches the output of the behavior-pattern learning engine
-- (frequent days, preferred hour, top machines, detected recurring routines,
-- and a consistency score) so it can be read cheaply instead of recomputed
-- from the full session history on every request.
CREATE TABLE "UserBehaviorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionCount" INTEGER NOT NULL DEFAULT 0,
    "frequentDays" JSONB,
    "preferredHour" INTEGER,
    "topMachines" JSONB,
    "routines" JSONB,
    "consistencyScore" DOUBLE PRECISION,
    "avgSessionsPerWeek" DOUBLE PRECISION,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBehaviorProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserBehaviorProfile_userId_key" ON "UserBehaviorProfile"("userId");
CREATE INDEX "UserBehaviorProfile_userId_idx" ON "UserBehaviorProfile"("userId");

ALTER TABLE "UserBehaviorProfile" ADD CONSTRAINT "UserBehaviorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
