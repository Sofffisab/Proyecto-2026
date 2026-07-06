import crypto from "crypto";

// ============================================================================
// Privacy / pseudonymization layer for admin-facing analytics & history
// exports (see insights.service.js#getFullHistoryAdmin).
//
// Goal: the admin "full history" view must be usable for legitimate gym
// operations (capacity planning, machine wear, trainer workload) without
// exposing every user's real identity by default, and must fully respect a
// user's withdrawn consent (UserSettings.analyticsConsent = false).
//
// - Users who have NOT withdrawn consent: shown with a stable pseudonymous
//   id (so an admin can still track "the same person" across rows/time) but
//   their real name/email is only attached if the caller explicitly asks for
//   identified records (`includeIdentifiers: true`), e.g. to investigate a
//   specific complaint.
// - Users who HAVE withdrawn consent (analyticsConsent = false): name/email
//   are never attached, regardless of `includeIdentifiers` — only the
//   pseudonymous id and the aggregate activity data are returned.
// ============================================================================

const PSEUDONYM_SECRET =
  process.env.ANALYTICS_PSEUDONYMIZATION_SECRET ??
  process.env.JWT_ACCESS_SECRET ??
  "insecure-dev-only-secret-change-me";

/**
 * One-way, stable pseudonym for a user id. Same input always produces the
 * same output (so records can still be grouped/correlated), but the real
 * userId cannot be recovered from it.
 */
export function pseudonymizeId(userId) {
  return crypto
    .createHmac("sha256", PSEUDONYM_SECRET)
    .update(String(userId))
    .digest("hex")
    .slice(0, 24);
}

/**
 * Shapes a user record for inclusion in an admin analytics/history export,
 * applying the consent + identification rules described above.
 *
 * @param {{id: string, firstName?: string, lastName?: string, email?: string, settings?: {analyticsConsent?: boolean}}} user
 * @param {{includeIdentifiers?: boolean}} options
 */
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
