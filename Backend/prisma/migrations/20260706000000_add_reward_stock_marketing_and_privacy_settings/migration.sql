-- Reward: admin-only stock control and marketing/merchandising classification.
ALTER TABLE "Reward" ADD COLUMN "stock" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Reward" ADD COLUMN "isMarketingItem" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Reward_active_idx" ON "Reward"("active");

-- UserSettings: "no usar la app para máquinas" preference + analytics consent
-- flag used to pseudonymize/filter the admin full-history export.
ALTER TABLE "UserSettings" ADD COLUMN "machineTrackingOptOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserSettings" ADD COLUMN "analyticsConsent" BOOLEAN NOT NULL DEFAULT true;
