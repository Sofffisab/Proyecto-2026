// Fire-and-forget "something changed" signal for the trainer/admin apps (see
// the "Staff live updates" section of ably.js). It can never break the action
// that triggers it: no Ably, a failed publish or a mocked module all end here.

import * as ably from "./ably.js";

export function signalStaff(topic, data) {
  try {
    const result = ably.emitStaffSignal?.(topic, data);
    if (result && typeof result.catch === "function") result.catch(() => {});
  } catch {
    // best effort
  }
}

export const TOPIC = {
  HELP: "help",
  PEOPLE: "people",
  CONFLICTS: "conflicts",
  ROUTINES: "routines",
  REPORTS: "reports",
};
