import { prisma } from "../config/index.js";
import { AppError } from "../utils/errors.js";
import { getVisibleExercisesByIds, serializeExercise } from "./exercise.service.js";

// Same rough estimate the app uses to show "60 min" on a day.
const MINUTES_PER_SET = 3;
// Upper bound for a single range query (a month view + padding).
const MAX_RANGE_DAYS = 62;

export const SCHEDULE_SOURCES = ["MANUAL", "AI", "GENERAL"];

// Dates

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar day written as "YYYY-MM-DD". */
export function isValidDateKey(value) {
  if (typeof value !== "string" || !DATE_KEY_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function assertDateKey(value, field = "date") {
  if (!isValidDateKey(value)) {
    throw new AppError(`${field} must be a valid date in YYYY-MM-DD format`, 400);
  }
}

function daysBetween(fromKey, toKey) {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

// Serialization

export function estimateMinutes(items) {
  return items.reduce((total, item) => total + (Number(item.sets) || 0) * MINUTES_PER_SET, 0);
}

/**
 * Turns a stored ScheduleDay row into the API shape, attaching the full
 * exercise object to every item so the app can render it without extra calls.
 * Items whose exercise no longer exists / isn't visible are dropped.
 */
export function toDayDto(row, exerciseMap) {
  const stored = Array.isArray(row.exercises) ? row.exercises : [];
  const exercises = stored
    .map((item) => {
      const exercise = exerciseMap.get(item.exerciseId);
      if (!exercise) return null;
      return { exerciseId: item.exerciseId, sets: item.sets, reps: item.reps, exercise };
    })
    .filter(Boolean);

  return {
    id: row.id,
    date: row.date,
    title: row.title,
    source: row.source,
    generalRoutineId: row.generalRoutineId ?? null,
    exercises,
    exerciseCount: exercises.length,
    estimatedMinutes: estimateMinutes(exercises),
  };
}

export async function hydrateDays(userId, rows) {
  const ids = rows.flatMap((row) =>
    (Array.isArray(row.exercises) ? row.exercises : []).map((item) => item.exerciseId)
  );
  const exerciseMap = await getVisibleExercisesByIds(userId, ids);
  return rows.map((row) => toDayDto(row, exerciseMap));
}

// General ("default") routines

function toGeneralSummary(routine) {
  const items = routine.exercises ?? [];
  return {
    id: routine.id,
    slug: routine.slug,
    title: routine.title,
    titleEn: routine.titleEn ?? null,
    description: routine.description ?? null,
    level: routine.level ?? null,
    exerciseCount: items.length,
    estimatedMinutes: estimateMinutes(items),
  };
}

/** List for the "Rutinas generales" screen (no exercise bodies, just counts). */
export async function listGeneralRoutines() {
  const routines = await prisma.generalRoutine.findMany({
    where: { active: true },
    orderBy: [{ position: "asc" }, { title: "asc" }],
    include: { exercises: { select: { sets: true } } },
  });
  return routines.map(toGeneralSummary);
}

/** One general routine with its exercises (ordered), by id or slug. */
export async function getGeneralRoutine(idOrSlug) {
  const routine = await prisma.generalRoutine.findFirst({
    where: { active: true, OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      exercises: {
        orderBy: { position: "asc" },
        include: { exercise: true },
      },
    },
  });
  if (!routine) throw new AppError("General routine not found", 404);

  const exercises = routine.exercises
    .filter((item) => item.exercise?.active)
    .map((item) => ({
      exerciseId: item.exerciseId,
      sets: item.sets,
      reps: item.reps,
      exercise: serializeExercise(item.exercise),
    }));

  return {
    ...toGeneralSummary({ ...routine, exercises }),
    exerciseCount: exercises.length,
    exercises,
  };
}

// Schedule days

/** Days with a saved routine between two dates (inclusive). */
export async function getScheduleRange(userId, from, to) {
  assertDateKey(from, "from");
  assertDateKey(to, "to");
  const span = daysBetween(from, to);
  if (span < 0) throw new AppError("'from' must not be after 'to'", 400);
  if (span > MAX_RANGE_DAYS) {
    throw new AppError(`Range too large (max ${MAX_RANGE_DAYS} days)`, 400);
  }

  const rows = await prisma.scheduleDay.findMany({
    where: { userId, date: { gte: from, lte: to } },
    orderBy: { date: "asc" },
  });
  return hydrateDays(userId, rows);
}

/** A single day, or null when nothing was saved for it. */
export async function getScheduleDay(userId, date) {
  assertDateKey(date);
  const row = await prisma.scheduleDay.findUnique({
    where: { userId_date: { userId, date } },
  });
  if (!row) return null;
  const [day] = await hydrateDays(userId, [row]);
  return day;
}

/**
 * Creates or replaces the routine of a day (what the "Guardar" button of the
 * day screen sends). `exercises` is the ordered list of { exerciseId, sets, reps }.
 */
export async function saveScheduleDay(userId, date, data) {
  assertDateKey(date);

  const items = (data.exercises ?? []).map((item) => ({
    exerciseId: item.exerciseId,
    sets: item.sets,
    reps: String(item.reps),
  }));

  const exerciseMap = await getVisibleExercisesByIds(
    userId,
    items.map((item) => item.exerciseId)
  );
  const unknown = items.find((item) => !exerciseMap.has(item.exerciseId));
  if (unknown) {
    throw new AppError(`Exercise not found: ${unknown.exerciseId}`, 400);
  }

  const payload = {
    title: (data.title ?? "").trim(),
    exercises: items,
    source: data.source ?? "MANUAL",
    generalRoutineId: data.generalRoutineId ?? null,
  };

  const row = await prisma.scheduleDay.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, ...payload },
    update: payload,
  });

  return toDayDto(row, exerciseMap);
}

export async function deleteScheduleDay(userId, date) {
  assertDateKey(date);
  await prisma.scheduleDay.deleteMany({ where: { userId, date } });
  return { deleted: true };
}
