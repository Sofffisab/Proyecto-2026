-- Keep the previous machine QR token around for a grace window after
-- rotation, so a QR that was valid "at the time" it was scanned (e.g.
-- printed/cached before the daily rotation cron ran) is still accepted
-- by the backend for history purposes instead of being flatly rejected.
ALTER TABLE "Machine" ADD COLUMN "previousQrToken" TEXT;
ALTER TABLE "Machine" ADD COLUMN "previousQrTokenValidUntil" TIMESTAMP(3);
