// Dev helper: forces a social matching round right now and explains why it
// paired (or did not pair) anybody.   Usage (from Backend/):  node force-social.mjs
//
// It lifts: the Redis "one round per interval" lock, the 30 min pair cooldown
// and invitations that are still open. Only this script is affected, not the app.

process.env.SOCIAL_PAIR_COOLDOWN_MS = "1";

import "dotenv/config";
import { prisma, redis } from "./src/config/index.js";
import { runMatchingRound, getSocialConfig } from "./src/services/social.service.js";
import { getLobbyMemberIds } from "./src/realtime/ably.js";

process.env.SOCIAL_PAIR_COOLDOWN_MS = "1";

const open = await prisma.gymSession.findMany({
  where: { checkOutAt: null },
  select: { userId: true, user: { select: { email: true, role: true, isActive: true, gender: true, birthday: true } } },
});

console.log(`\n1) Check-ins abiertos en la BD: ${open.length}`);
for (const s of open) console.log(`   - ${s.user.email}  rol=${s.user.role}  activo=${s.user.isActive}  genero=${s.user.gender}`);

const members = open.filter((s) => s.user.role === "USER" && s.user.isActive);
console.log(`   Socios (rol USER) activos con check-in: ${members.length}  (staff no participa)`);
if (!members.length) { console.log("❌ Hace falta al menos 2 SOCIOS con check-in abierto."); process.exit(0); }

const lobby = await getLobbyMemberIds();
console.log(`\n2) Lobby de Ably (apps abiertas ahora): ${lobby === null ? "NO SE PUDO LEER (¿falta ABLY_API_KEY en tu .env local?)" : lobby.length}`);
if (lobby) for (const id of lobby) console.log(`   - ${open.find((s) => s.userId === id)?.user.email ?? id}`);
if (lobby === null) process.exit(0);

const inLobby = members.filter((s) => lobby.includes(s.userId));
console.log(`   Socios con check-in Y en el lobby: ${inLobby.length}`);
if (inLobby.length < 2) {
  console.log("❌ Menos de 2 socios en el lobby. Cada celular tiene que tener la app abierta (pantalla social) con check-in hecho.");
}

const settings = await prisma.userSettings.findMany({
  where: { userId: { in: inLobby.map((s) => s.userId) } },
  select: { userId: true, disableSocial: true, socialSameGenderOnly: true, socialSameAgeRangeOnly: true },
});
for (const st of settings) {
  const email = open.find((s) => s.userId === st.userId)?.user.email;
  if (st.disableSocial) console.log(`   ⚠️ ${email} tiene la interacción social DESACTIVADA en Ajustes`);
  if (st.socialSameGenderOnly) console.log(`   ⚠️ ${email} filtra por mismo género`);
  if (st.socialSameAgeRangeOnly) console.log(`   ⚠️ ${email} filtra por rango de edad`);
}

const ids = inLobby.map((s) => s.userId);
const blocks = await prisma.userBlock.count({ where: { OR: [{ blockerId: { in: ids } }, { blockedId: { in: ids } }] } });
if (blocks) console.log(`   ⚠️ Hay ${blocks} bloqueo(s) entre estos usuarios`);

// Clear the lock and open invitations, then run.
const slot = Math.floor(Date.now() / getSocialConfig().roundIntervalMs);
await redis?.del(`social:round:${slot}`);
const closed = await prisma.socialChallenge.updateMany({
  where: { isRealtime: true, status: { in: ["ASSIGNED", "ACCEPTED"] } },
  data: { status: "EXPIRED" },
});
if (closed.count) console.log(`\n🧹 Invitaciones abiertas cerradas: ${closed.count}`);

console.log("\n🚀 Resultado:", await runMatchingRound(inLobby[0]?.userId ?? members[0].userId));
process.exit(0);
