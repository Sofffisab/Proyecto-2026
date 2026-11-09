// Audit trail of what admins and trainers (and a few member decisions, like
// answering a routine proposal) do in the app. Shown in the admin "Historial".
//
// Rows are insert-only: nothing in the app updates or deletes them.
// Writing is best-effort on purpose: failing to log must never break the real
// action, so logActivity swallows and logs its errors and resolves to null.

import { prisma } from "../config/index.js";
import { logger } from "../utils/logger.js";

export const ACTIVITY = {
  // Accounts
  ACCOUNT_CREATED: "ACCOUNT_CREATED",
  ACCOUNT_ACTIVATED: "ACCOUNT_ACTIVATED",
  ACCOUNT_DEACTIVATED: "ACCOUNT_DEACTIVATED",
  INVITE_RESENT: "INVITE_RESENT",
  // Prizes
  REWARD_CREATED: "REWARD_CREATED",
  REWARD_EDITED: "REWARD_EDITED",
  REWARD_STOCK_ADDED: "REWARD_STOCK_ADDED",
  REWARD_CURRENT_SET: "REWARD_CURRENT_SET",
  REWARD_DELIVERIES_PAUSED: "REWARD_DELIVERIES_PAUSED",
  REWARD_DELIVERIES_RESUMED: "REWARD_DELIVERIES_RESUMED",
  REWARD_DELIVERED: "REWARD_DELIVERED",
  // Reports
  REPORT_ACCEPTED: "REPORT_ACCEPTED",
  REPORT_REJECTED: "REPORT_REJECTED",
  REPORT_ESCALATED: "REPORT_ESCALATED",
  REPORT_REVERTED: "REPORT_REVERTED",
  REVIEW_REQUEST_RESOLVED: "REVIEW_REQUEST_RESOLVED",
  TRAINER_REPORT_SENT: "TRAINER_REPORT_SENT",
  // Machines
  MACHINE_CONFLICT_RESOLVED: "MACHINE_CONFLICT_RESOLVED",
  MACHINE_CREATED: "MACHINE_CREATED",
  MACHINE_QR_REGENERATED: "MACHINE_QR_REGENERATED",
  MACHINE_DEACTIVATED: "MACHINE_DEACTIVATED",
  // Routines
  ROUTINE_REQUEST_ACCEPTED: "ROUTINE_REQUEST_ACCEPTED",
  ROUTINE_REQUEST_REJECTED: "ROUTINE_REQUEST_REJECTED",
  ROUTINE_PROPOSED: "ROUTINE_PROPOSED",
  ROUTINE_PROPOSAL_ACCEPTED: "ROUTINE_PROPOSAL_ACCEPTED",
  ROUTINE_PROPOSAL_DECLINED: "ROUTINE_PROPOSAL_DECLINED",
  // Help
  ASSISTANCE_STARTED: "ASSISTANCE_STARTED",
  ASSISTANCE_COMPLETED: "ASSISTANCE_COMPLETED",
};

/** Records one row. Never throws. */
export async function logActivity({ actorId, action, entityType = null, entityId = null, metadata = null }) {
  try {
    if (!actorId || !action) return null;
    if (!prisma?.activityLog?.create) return null;

    return await prisma.activityLog.create({
      data: { actorId, action, entityType, entityId, metadata: metadata ?? undefined },
    });
  } catch (err) {
    logger.error(`[activity] Could not log ${action}: ${err.message}`);
    return null;
  }
}
