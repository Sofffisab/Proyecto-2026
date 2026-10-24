// Development-only helper: fills a user's history (GymSession + MachineUsage)
// with a realistic training habit so the personalized routine generator has
// something to learn from. Requires the machines created by prisma/seed.js.
//
// Usage (from /Backend):
//   node prisma/seedDemoHistory.js <email> [weeks=8]
//
// Habit: Monday = chest/triceps, Wednesday = back/biceps, Friday = legs + cardio,
// around 18:00, ~60 minutes. Refuses to run if the user already has sessions.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const HABIT = {
  1: ["Bench Press", "Press Declinado", "Pec Deck", "Polea Alta"],
  3: ["Jalón al Pecho", "Remo Sentado", "Polea Alta"],
  5: ["Prensa de Piernas", "Extensión de Cuádriceps", "Curl Femoral", "Cinta de Correr"],
};

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to run in production");

  const email = process.argv[2];
  const weeks = Number(process.argv[3] ?? 8);
  if (!email) throw new Error("Usage: node prisma/seedDemoHistory.js <email> [weeks]");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`User not found: ${email}`);

  const existing = await prisma.gymSession.count({ where: { userId: user.id } });
  if (existing > 0) throw new Error(`User already has ${existing} sessions; not adding demo data.`);

  const machines = await prisma.machine.findMany({ where: { active: true } });
  const byName = new Map(machines.map((m) => [m.name, m]));

  let created = 0;
  const today = new Date();
  for (let offset = weeks * 7; offset >= 1; offset -= 1) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset, 18, 0, 0);
    const names = HABIT[day.getDay()];
    if (!names) continue;

    const checkOutAt = new Date(day.getTime() + 60 * 60 * 1000);
    const session = await prisma.gymSession.create({
      data: { userId: user.id, checkInAt: day, checkOutAt, durationMinutes: 60 },
    });

    let cursor = day.getTime();
    for (const name of names) {
      const machine = byName.get(name);
      if (!machine) continue;
      const startedAt = new Date(cursor);
      const endedAt = new Date(cursor + 12 * 60 * 1000);
      cursor += 14 * 60 * 1000;
      await prisma.machineUsage.create({
        data: {
          userId: user.id,
          machineId: machine.id,
          gymSessionId: session.id,
          startedAt,
          endedAt,
          durationMinutes: 12,
        },
      });
    }
    created += 1;
  }

  console.log(`Demo history created for ${email}: ${created} sessions over ${weeks} weeks.`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
