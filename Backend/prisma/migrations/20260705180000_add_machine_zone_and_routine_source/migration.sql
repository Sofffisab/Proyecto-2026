-- Add physical zone/station to Machine, used to tell a trainer where a
-- student is currently standing when alerting them of a returning student.
ALTER TABLE "Machine" ADD COLUMN "zone" TEXT;

-- Track whether a Routine came from the AI suggestion engine vs. was
-- created manually by the user, so the frontend can label it and the
-- suggestion-accept flow can be idempotent per generated suggestion.
ALTER TABLE "Routine" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';
