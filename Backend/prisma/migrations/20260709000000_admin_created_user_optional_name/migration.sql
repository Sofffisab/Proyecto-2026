-- Admin-created accounts now only require an email. firstName/lastName are
-- filled in later by the user themselves, so they must be nullable.
ALTER TABLE "User" ALTER COLUMN "firstName" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "lastName" DROP NOT NULL;
