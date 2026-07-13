import crypto from "crypto";

// Pseudonymization for admin analytics/history exports (insights.service.js).
// Real name/email are only attached when consent is given AND includeIdentifiers=true.

const PSEUDONYM_SECRET =
  process.env.ANALYTICS_PSEUDONYMIZATION_SECRET ??
  process.env.JWT_ACCESS_SECRET ??
  "insecure-dev-only-secret-change-me";

// One-way, stable pseudonym for a user id (groupable, not reversible).
export function pseudonymizeId(userId) {
  return crypto
    .createHmac("sha256", PSEUDONYM_SECRET)
    .update(String(userId))
    .digest("hex")
    .slice(0, 24);
}

// Shapes a user record for an analytics export, applying the consent rules above.
export function shapeUserForAnalytics(user, { includeIdentifiers = false } = {}) {
  const consented = user.settings?.analyticsConsent !== false;
  const pseudoId = pseudonymizeId(user.id);

  const shaped = { pseudoId, consented };

  if (includeIdentifiers && consented) {
    shaped.userId = user.id;
    shaped.name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
    shaped.email = user.email ?? null;
  }

  return shaped;
}
