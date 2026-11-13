// Dev helper: forces a social matching round right now, with no waiting.
// Usage (from Backend/):  node force-social.mjs
//
// It lifts the three things that make a round come back with 0 pairs:
//   1. the "one round per interval" Redis lock,
//   2. the pair cooldown (same two people are not paired again for 30 min),
//   3. invitations that are still open (people with an open challenge are skipped).
// It only changes how THIS script runs: the deployed app keeps its normal rules.

// Read lazily by getSocialConfig(), so setting it before the call is enough.
// 1 ms = "nobody was paired recently".
process.env.SOCIAL_PAIR_COOLDOWN_MS = "1";

import "dotenv/config";
import { prisma, redis } from "./src/config/index.js";
import { runMatchingRound, getSocialConfig } from "./src/services/social.service.js";

// dotenv/config may load a SOCIAL_PAIR_COOLDOWN_MS from .env; force ours again.
process.env.SOCIAL_PAIR_COOLDOWN_MS = "1";

const s = await prisma.gymSession.findFirst({
  where: { checkOutAt: null },
  select: { userId: true },
});

if (!s) {
  console.log("❌ Nadie tiene check-in abierto en la BD.");
  process.exit(0);
}

// 1) Clear the round lock.
const slot = Math.floor(Date.now() / getSocialConfig().roundIntervalMs);
await redis?.del(`social:round:${slot}`);

// 2) Close invitations that are still open so those people can be matched again.
const closed = await prisma.socialChallenge.updateMany({
  where: { isRealtime: true, status: { in: ["ASSIGNED", "ACCEPTED"] } },
  data: { status: "EXPIRED" },
});
if (closed.count) console.log(`🧹 Invitaciones abiertas cerradas: ${closed.count}`);

console.log("🚀 Resultado:", await runMatchingRound(s.userId));
process.exit(0);
