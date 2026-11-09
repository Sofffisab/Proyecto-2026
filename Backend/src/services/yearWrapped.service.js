// Backend/src/services/yearWrapped.service.js
//
// Calcula los números del "Wrapped" de fin de año para UN usuario.
// Está separado en dos partes para poder testearlo sin base de datos:
//
//   1) fetchYearWrappedRaw(prisma, userId, year)  -> hace las queries
//   2) buildYearWrapped(raw, opts)                -> función PURA que arma el payload
//
// No guarda nada en la tabla `Wrapped` (esa ya la usa wrapped.service.js con
// otro formato); se calcula al vuelo.
//
// Uso típico (ver controllers/yearWrapped.controller.js):
//   import { prisma } from "../config/index.js";
//   const data = await generateYearWrapped(prisma, req.user.id, 2026);

// Argentina (UTC-3). Se usa para decidir en qué "día" cae cada check-in.
export const DEFAULT_TZ_OFFSET_MINUTES = -180;

const GOAL_TYPE_LABEL = {
  WEIGHT: "Peso",
  MUSCLE: "Masa muscular",
  FAT: "Grasa corporal",
  PHYSICAL_HEALTH: "Salud física",
  MENTAL_HEALTH: "Salud mental",
  STRENGTH: "Fuerza",
  ENDURANCE: "Resistencia",
  COMMITMENT: "Constancia",
  MOBILITY: "Movilidad",
  NONE: "Meta personal",
  OTHER: "Meta personal",
};

const GOAL_ACTION_LABEL = { GAIN: "Subir", LOSE: "Bajar", MAINTAIN: "Mantener" };

// English versions of the labels above, used when the member's app is in English.
const GOAL_TYPE_LABEL_EN = {
  WEIGHT: "Weight",
  MUSCLE: "Muscle mass",
  FAT: "Body fat",
  PHYSICAL_HEALTH: "Physical health",
  MENTAL_HEALTH: "Mental health",
  STRENGTH: "Strength",
  ENDURANCE: "Endurance",
  COMMITMENT: "Consistency",
  MOBILITY: "Mobility",
  NONE: "Personal goal",
  OTHER: "Personal goal",
};
const GOAL_ACTION_LABEL_EN = { GAIN: "Raise", LOSE: "Lower", MAINTAIN: "Keep" };
const DIFFICULTY_WEIGHT = { HARD: 3, MEDIUM: 2, EASY: 1 };

// ---------- helpers de fecha ----------

function yearRange(year, tzOffsetMinutes) {
  // Inicio/fin del año calendario en la zona horaria elegida, expresado en UTC.
  const start = new Date(Date.UTC(year, 0, 1) - tzOffsetMinutes * 60000);
  const end = new Date(Date.UTC(year + 1, 0, 1) - tzOffsetMinutes * 60000);
  return { start, end };
}

function localDateKey(date, tzOffsetMinutes) {
  // "YYYY-MM-DD" en la zona horaria del gimnasio.
  return new Date(new Date(date).getTime() + tzOffsetMinutes * 60000)
    .toISOString()
    .slice(0, 10);
}

function goalLabel(goal, language = "es") {
  const en = language === "en";
  const type = goal.subType || (en ? GOAL_TYPE_LABEL_EN : GOAL_TYPE_LABEL)[goal.type] || (en ? "Personal goal" : "Meta personal");
  const action = (en ? GOAL_ACTION_LABEL_EN : GOAL_ACTION_LABEL)[goal.action] || "";
  const target = Number.isFinite(goal.targetValue)
    ? `${Number.isInteger(goal.targetValue) ? goal.targetValue : goal.targetValue.toFixed(1)}${goal.unit ? ` ${goal.unit}` : ""}`
    : "";
  return [type, [action, target].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
}

// ---------- 1) queries ----------

export async function fetchYearWrappedRaw(prisma, userId, year, { tzOffsetMinutes = DEFAULT_TZ_OFFSET_MINUTES } = {}) {
  const { start, end } = yearRange(year, tzOffsetMinutes);
  const inYear = { gte: start, lt: end };

  const [
    user,
    sessions,
    machineUsages,
    pointRows,
    friendChallenges,
    unlockedAchievements,
    completedProgress,
    scheduleDays,
    createdRoutines,
    totalMachines,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { firstName: true } }),
    prisma.gymSession.findMany({
      where: { userId, checkInAt: inYear },
      select: { id: true, checkInAt: true, durationMinutes: true },
    }),
    prisma.machineUsage.findMany({
      where: { userId, startedAt: inYear },
      select: { machineId: true, gymSessionId: true, startedAt: true, machine: { select: { name: true } } },
    }),
    prisma.pointTransaction.findMany({
      where: { userId, createdAt: inYear },
      select: { points: true, createdAt: true },
    }),
    prisma.socialChallenge.findMany({
      where: {
        status: "COMPLETED",
        completedAt: inYear,
        OR: [{ userId }, { partnerUserId: userId }],
      },
      select: { userId: true, partnerUserId: true },
    }),
    prisma.userAchievement.count({ where: { userId, unlockedAt: inYear } }),
    prisma.progressEntry.findMany({
      where: { userId, createdAt: inYear, progressPercent: { gte: 100 } },
      select: { goalId: true, createdAt: true },
    }),
    prisma.scheduleDay.findMany({
      where: { userId, date: { gte: `${year}-01-01`, lte: `${year}-12-31` } },
      select: { id: true, title: true, generalRoutineId: true },
    }),
    prisma.routine.findMany({
      where: { userId, createdAt: inYear },
      select: { id: true, name: true },
    }),
    prisma.machine.count({ where: { active: true } }),
  ]);

  // Metas completadas: última vez que cada meta llegó al 100% durante el año.
  const completedAtByGoal = new Map();
  for (const e of completedProgress) {
    const prev = completedAtByGoal.get(e.goalId);
    if (!prev || e.createdAt > prev) completedAtByGoal.set(e.goalId, e.createdAt);
  }
  const goals = completedAtByGoal.size
    ? await prisma.goal.findMany({
        where: { id: { in: [...completedAtByGoal.keys()] }, userId },
        select: { id: true, type: true, subType: true, unit: true, action: true, targetValue: true, difficulty: true },
      })
    : [];

  return {
    user,
    sessions,
    machineUsages,
    pointRows,
    friendChallenges,
    unlockedAchievements,
    goals: goals.map((g) => ({ ...g, completedAt: completedAtByGoal.get(g.id) })),
    scheduleDays,
    createdRoutines,
    totalMachines,
  };
}

// ---------- 2) agregación pura ----------

export function buildYearWrapped(raw, { year, userId, tzOffsetMinutes = DEFAULT_TZ_OFFSET_MINUTES, language = "es" } = {}) {
  const key = (d) => localDateKey(d, tzOffsetMinutes);

  // Puntos GANADOS: solo transacciones positivas (los descuentos/canjes no restan al "ganado").
  const totalPoints = raw.pointRows.reduce((acc, r) => acc + (r.points > 0 ? r.points : 0), 0);

  // Amigos: personas distintas con las que se completó un desafío social.
  const friendIds = new Set();
  for (const c of raw.friendChallenges) {
    friendIds.add(c.userId === userId ? c.partnerUserId : c.userId);
  }

  // Días de gimnasio: días calendario distintos con al menos un check-in.
  const gymDayKeys = new Set(raw.sessions.map((s) => key(s.checkInAt)));

  // Máquinas distintas + favorita.
  const machineCounts = new Map(); // machineId -> { name, count }
  for (const u of raw.machineUsages) {
    const cur = machineCounts.get(u.machineId) ?? { name: u.machine?.name ?? "Máquina", count: 0 };
    cur.count += 1;
    machineCounts.set(u.machineId, cur);
  }
  const topMachine =
    [...machineCounts.values()].sort((a, b) => b.count - a.count)[0] ?? null;

  // Día más intenso: puntaje = minutos entrenados + 10 por cada uso de máquina ese día.
  const byDay = new Map(); // "YYYY-MM-DD" -> { minutes, machines, points }
  const day = (k) => {
    if (!byDay.has(k)) byDay.set(k, { minutes: 0, machines: 0, points: 0 });
    return byDay.get(k);
  };
  for (const s of raw.sessions) day(key(s.checkInAt)).minutes += s.durationMinutes || 0;
  for (const u of raw.machineUsages) day(key(u.startedAt)).machines += 1;
  for (const r of raw.pointRows) if (r.points > 0) day(key(r.createdAt)).points += r.points;

  let mostIntenseDay = null;
  let bestScore = -1;
  for (const [date, v] of byDay) {
    if (!gymDayKeys.has(date)) continue; // solo días en los que realmente fue al gym
    const score = v.minutes + v.machines * 10;
    if (score > bestScore) {
      bestScore = score;
      mostIntenseDay = { date, minutes: v.minutes, machines: v.machines, points: v.points };
    }
  }

  // Rutinas distintas: días del cronograma (por rutina general o por título) + rutinas creadas este año.
  const routineKeys = new Set();
  for (const d of raw.scheduleDays) {
    if (d.generalRoutineId) routineKeys.add(`g:${d.generalRoutineId}`);
    else if (d.title && d.title.trim()) routineKeys.add(`t:${d.title.trim().toLowerCase()}`);
  }
  for (const r of raw.createdRoutines) {
    routineKeys.add(r.name && r.name.trim() ? `t:${r.name.trim().toLowerCase()}` : `r:${r.id}`);
  }

  // Metas: más difíciles primero, y a igual dificultad, las más recientes.
  const goalItems = raw.goals
    .map((g) => ({
      id: g.id,
      label: goalLabel(g, language),
      difficulty: g.difficulty,
      completedAt: g.completedAt ? new Date(g.completedAt).toISOString() : null,
    }))
    .sort(
      (a, b) =>
        (DIFFICULTY_WEIGHT[b.difficulty] ?? 0) - (DIFFICULTY_WEIGHT[a.difficulty] ?? 0) ||
        String(b.completedAt).localeCompare(String(a.completedAt))
    );

  return {
    year,
    firstName: raw.user?.firstName ?? null,
    totalPoints,
    friendsMade: friendIds.size,
    achievementsUnlocked: raw.unlockedAchievements,
    gymDays: gymDayKeys.size,
    goalsCompleted: { count: goalItems.length, items: goalItems },
    machinesUsed: machineCounts.size,
    totalMachines: raw.totalMachines ?? null,
    topMachine,
    mostIntenseDay,
    distinctRoutines: routineKeys.size,
    gift: {
      percent: 50,
      concept: language === "en" ? "January fee" : "cuota de enero",
      // Stable code so the app can show it in whichever language it is using.
      conceptCode: "JANUARY_FEE",
      validUntil: `${year + 1}-01-31`,
    },
  };
}

// ---------- API pública ----------

export async function generateYearWrapped(prisma, userId, year, opts = {}) {
  const raw = await fetchYearWrappedRaw(prisma, userId, year, opts);
  return buildYearWrapped(raw, { year, userId, ...opts });
}
