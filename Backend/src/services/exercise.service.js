import { prisma } from "../config/index.js";
import { AppError } from "../utils/errors.js";

// Muscle-group keys used by Exercise.muscles (and by the app's filter chips).
export const MUSCLE_GROUPS = [
  "chest",
  "triceps",
  "back",
  "biceps",
  "shoulders",
  "legs",
  "glutes",
  "core",
  "cardio",
];

// Safety cap so a single member can't fill the table with custom exercises.
const MAX_CUSTOM_EXERCISES_PER_USER = 200;

/** Shape sent to the app (the Prisma row minus internals). */
export function serializeExercise(exercise) {
  return {
    id: exercise.id,
    slug: exercise.slug ?? null,
    name: exercise.name,
    nameEn: exercise.nameEn ?? null,
    description: exercise.description ?? "",
    descriptionEn: exercise.descriptionEn ?? null,
    muscles: exercise.muscles ?? [],
    level: exercise.level,
    category: exercise.category,
    sets: exercise.defaultSets,
    reps: exercise.defaultReps,
    imageUrl: exercise.imageUrl ?? null,
    isCustom: exercise.isCustom,
  };
}

/**
 * Exercises the member can pick from: the gym's built-in catalog plus the
 * ones this member created. Optional filters: `muscle` (one MUSCLE_GROUPS
 * key) and `q` (case-insensitive name search, Spanish or English).
 */
export async function listExercises(userId, { muscle, q } = {}) {
  const and = [{ active: true }, { OR: [{ isCustom: false }, { createdById: userId }] }];

  if (muscle) and.push({ muscles: { has: muscle } });

  const query = typeof q === "string" ? q.trim() : "";
  if (query) {
    and.push({
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { nameEn: { contains: query, mode: "insensitive" } },
      ],
    });
  }

  const exercises = await prisma.exercise.findMany({
    where: { AND: and },
    orderBy: [{ isCustom: "asc" }, { name: "asc" }],
  });

  return {
    muscleGroups: MUSCLE_GROUPS,
    exercises: exercises.map(serializeExercise),
  };
}

/** Creates a private exercise ("Crear ejercicio propio") owned by the caller. */
export async function createCustomExercise(userId, data) {
  const owned = await prisma.exercise.count({
    where: { createdById: userId, isCustom: true },
  });
  if (owned >= MAX_CUSTOM_EXERCISES_PER_USER) {
    throw new AppError("Custom exercise limit reached", 400);
  }

  const created = await prisma.exercise.create({
    data: {
      name: data.name,
      description: data.description ?? "",
      muscles: data.muscles ?? [],
      machineKeywords: [],
      defaultSets: data.sets ?? 3,
      defaultReps: data.reps ?? "10-12",
      imageUrl: data.imageUrl ?? null,
      isCustom: true,
      createdById: userId,
    },
  });

  return serializeExercise(created);
}

/**
 * Looks up exercises by id, limited to what this member may use (built-in or
 * their own). Returns a Map(id -> serialized exercise).
 */
export async function getVisibleExercisesByIds(userId, ids) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();

  const rows = await prisma.exercise.findMany({
    where: {
      id: { in: unique },
      active: true,
      OR: [{ isCustom: false }, { createdById: userId }],
    },
  });

  return new Map(rows.map((row) => [row.id, serializeExercise(row)]));
}
