import { prisma } from "../config/index.js";
import { AppError } from "../utils/errors.js";
import { analyzeUserPatterns } from "./behaviorAnalysis.service.js";
import { serializeExercise } from "./exercise.service.js";
import { assertDateKey, toDayDto } from "./schedule.service.js";

// ---------------------------------------------------------------------------
// Personalized routine generator ("Hacer con IA personalizada").
//
// A rules engine (no external AI service): it reads from the database what the
// member really did and built, analyses it here in the backend and turns the
// result into a plan made only of exercises from the catalog.
//
// What it learns from:
//   A. Their PAST ROUTINES (ScheduleDay: the days they built by hand, copied
//      from a general routine or generated before):
//        - which exercises they repeat (recency-weighted);
//        - which exercises/muscles they put on each weekday;
//        - the sets x reps they used for each exercise (it reuses the latest);
//        - how many days per week they plan and how long their routines are.
//   B. Their GYM HISTORY (GymSession, MachineUsage + Machine - the data behind
//      the History screen): machines used, weighted by recency, mapped to
//      exercises/muscles through Exercise.machineKeywords; real session length;
//      weekly frequency; recurring routines (behaviorAnalysis.service.js).
//      This part is skipped when the member disabled machine tracking.
//   C. The profile they filled in: goal, level, training type, weekly days.
//
// Muscles they neglect get a balance bonus, exercises used in the last days are
// slightly avoided so the plan rotates, and with no history at all it falls
// back to the profile alone.
//
// Two layers so the analysis is testable without a database: the DB layer
// (loadGeneratorInput, generateRoutines) and PURE functions
// (buildTrainingProfile, planDays, ...).
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

// Only the last N days of history are analysed.
export const HISTORY_WINDOW_DAYS = 120;
// A machine used N days ago weighs half of one used today.
const RECENCY_HALF_LIFE_DAYS = 30;
// Exercises from days saved in the last N days are slightly avoided so the
// generated plan rotates instead of repeating itself.
const NOVELTY_WINDOW_DAYS = 14;
// Below this many sessions (or no machine that maps to the catalog) we don't
// pretend to have learned anything and fall back to the profile only.
const MIN_SESSIONS_FOR_LEARNING = 3;
// Same for past routines (saved days with exercises).
const MIN_ROUTINES_FOR_LEARNING = 3;
const MINUTES_PER_SET = 3;
// Sessions needed on one weekday before that weekday's habit overrides the rotation.
const MIN_WEEKDAY_SESSIONS = 2;
// Observed weekly frequency is trusted only with at least this many sessions.
const MIN_SESSIONS_FOR_FREQUENCY = 6;
const MIN_ROUTINES_FOR_FREQUENCY = 6;
// Share of a weekday's training a focus must cover to be chosen for it.
const WEEKDAY_FOCUS_MIN_SHARE = 0.5;
// ...and at least this fraction of the best-covering focus (narrowest wins).
const WEEKDAY_FOCUS_RELATIVE_SHARE = 0.7;

const MAX_DATES_PER_REQUEST = 14;
const DEFAULT_SESSION_MINUTES = 60;
const MINUTES_PER_EXERCISE = 10;

// Score weights (see scoreExercise); the positive ones sum to 1.
const WEIGHTS = {
  affinity: 0.3, // machines the member uses that are tied to this exercise
  routine: 0.2, // exercises the member keeps putting in their own routines
  weekdayRoutine: 0.15, // ...and that they did on this same weekday
  pattern: 0.05, // belongs to a detected recurring gym routine
  goal: 0.1, // fits their goal + training type
  level: 0.1, // fits their experience level
  balance: 0.1, // trains a neglected muscle
  recentPenalty: 0.2, // already in a recently saved day
  batchPenalty: 0.3, // already used earlier in this same generation
};

const LEVEL_RANK = { BEGINNER: 0, INTERMEDIATE: 1, ADVANCED: 2 };

const FREQUENCY_TO_DAYS = {
  ONE_TO_TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
  SIX: 6,
  SEVEN: 6, // a 7-day week still gets one rest day in the split
};

// Goal priority when several are selected: the first one present wins.
const GOAL_PRIORITY = ["GAIN_MUSCLE", "INCREASE_ENDURANCE", "LOSE_WEIGHT", "IMPROVE_HEALTH"];

// Base prescription per goal. Level then adjusts the sets.
const SCHEMES = {
  GAIN_MUSCLE: { sets: 4, reps: "8-10" },
  LOSE_WEIGHT: { sets: 3, reps: "12-15" },
  INCREASE_ENDURANCE: { sets: 3, reps: "15-20" },
  IMPROVE_HEALTH: { sets: 3, reps: "10-12" },
};

const STRENGTH_MUSCLES = ["chest", "triceps", "back", "biceps", "shoulders", "legs", "glutes", "core"];
// Big muscle groups first when ordering a day.
const MUSCLE_ORDER = ["legs", "glutes", "back", "chest", "shoulders", "biceps", "triceps", "core", "cardio"];

export const FOCUS = {
  FULL: STRENGTH_MUSCLES,
  PUSH: ["chest", "shoulders", "triceps"],
  PULL: ["back", "biceps"],
  LEGS: ["legs", "glutes", "core"],
  UPPER: ["chest", "back", "shoulders", "biceps", "triceps"],
};

// Foci a weekday habit can resolve to, narrowest first.
const HABIT_FOCI = ["PUSH", "PULL", "LEGS", "UPPER"];

// Weekly split used for N training days per week.
const SPLITS = {
  1: ["FULL"],
  2: ["FULL"],
  3: ["PUSH", "PULL", "LEGS"],
  4: ["PUSH", "PULL", "LEGS", "UPPER"],
  5: ["PUSH", "PULL", "LEGS", "UPPER", "FULL"],
  6: ["PUSH", "PULL", "LEGS", "PUSH", "PULL", "LEGS"],
};

export const FOCUS_TITLES = {
  FULL: { es: "Cuerpo completo", en: "Full body" },
  PUSH: { es: "Empuje: pecho, hombros y tríceps", en: "Push: chest, shoulders & triceps" },
  PULL: { es: "Tirón: espalda y bíceps", en: "Pull: back & biceps" },
  LEGS: { es: "Piernas y glúteos", en: "Legs & glutes" },
  UPPER: { es: "Tren superior", en: "Upper body" },
};

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

export function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** True when a machine's name matches any of an exercise's keywords. */
export function machineMatchesExercise(machineName, keywords = []) {
  const machine = normalizeText(machineName);
  if (machine.length < 3) return false;
  return keywords.some((keyword) => {
    const k = normalizeText(keyword);
    return k.length >= 3 && (machine.includes(k) || k.includes(machine));
  });
}

function dateKeyOf(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function weekdayOf(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function weekStartKey(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return dateKeyOf(date);
}

const sum = (values) => values.reduce((total, value) => total + value, 0);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function pickGoal(objectives) {
  const list = Array.isArray(objectives) ? objectives : [];
  return GOAL_PRIORITY.find((goal) => list.includes(goal)) ?? "IMPROVE_HEALTH";
}

function isCardio(exercise) {
  return (exercise.muscles ?? []).includes("cardio");
}

/** Spreads a machine's weight over the muscles of the exercises it maps to. */
function addMuscleLoad(target, matchedExercises, weight) {
  if (matchedExercises.length === 0) return;
  const perExercise = weight / matchedExercises.length;
  for (const exercise of matchedExercises) {
    const muscles = exercise.muscles ?? [];
    if (muscles.length === 0) continue;
    for (const muscle of muscles) {
      target[muscle] = (target[muscle] ?? 0) + perExercise / muscles.length;
    }
  }
}

// ---------------------------------------------------------------------------
// Analysis (pure): raw DB rows -> training profile
// ---------------------------------------------------------------------------

/**
 * @param {object} input
 * @param {object} input.user - { trainingLevel, objectives, weeklyTrainingDays, trainingType }
 * @param {boolean} input.optedOut - member disabled machine tracking
 * @param {object[]} input.catalog - Exercise rows the member can use
 * @param {object[]} input.sessions - GymSession rows with machineUsages[].machine.name
 * @param {object|null} input.patterns - result of analyzeUserPatterns
 * @param {object[]} input.pastRoutines - [{ date, exercises: [{ exerciseId, sets, reps }] }] ascending
 * @param {string[]} input.recentExerciseIds - exercise ids of recently saved days
 * @param {number} input.rotationOffset - where to continue the weekly split
 * @param {Date} input.now
 */
export function buildTrainingProfile(input) {
  const {
    user,
    optedOut = false,
    catalog,
    sessions = [],
    patterns = null,
    pastRoutines = [],
    recentExerciseIds = [],
    rotationOffset = 0,
    now = new Date(),
  } = input;

  const level = user.trainingLevel ?? "BEGINNER";
  const goal = pickGoal(user.objectives);
  const trainingType = user.trainingType ?? null;

  // 1. Weight every machine the member used (recency-decayed), overall and per weekday.
  const machines = new Map(); // normalized name -> { name, weight, count }
  const weekdays = Array.from({ length: 7 }, () => ({ sessions: 0, machines: new Map() }));
  const durations = [];

  for (const session of sessions) {
    const checkIn = new Date(session.checkInAt);
    const weekday = checkIn.getDay();
    weekdays[weekday].sessions += 1;
    if (Number(session.durationMinutes) > 0) durations.push(Number(session.durationMinutes));

    for (const usage of session.machineUsages ?? []) {
      const name = usage.machine?.name;
      if (!name) continue;
      const key = normalizeText(name);
      const usedAt = new Date(usage.startedAt ?? session.checkInAt);
      const ageDays = Math.max(0, (now.getTime() - usedAt.getTime()) / DAY_MS);
      const weight = 0.5 ** (ageDays / RECENCY_HALF_LIFE_DAYS);

      const entry = machines.get(key) ?? { name, weight: 0, count: 0 };
      entry.weight += weight;
      entry.count += 1;
      machines.set(key, entry);

      weekdays[weekday].machines.set(key, (weekdays[weekday].machines.get(key) ?? 0) + weight);
    }
  }

  // 2. Map machines to catalog exercises and spread the weight over muscles.
  const matchedByMachine = new Map();
  for (const key of machines.keys()) {
    matchedByMachine.set(
      key,
      catalog.filter((exercise) => machineMatchesExercise(key, exercise.machineKeywords))
    );
  }

  const affinity = new Map(); // exercise id -> raw affinity
  const muscleLoad = {};
  let mappedWeight = 0;

  for (const [key, entry] of machines) {
    const matched = matchedByMachine.get(key);
    if (matched.length === 0) continue; // machine not represented in the catalog
    mappedWeight += entry.weight;
    addMuscleLoad(muscleLoad, matched, entry.weight);
    for (const exercise of matched) {
      affinity.set(exercise.id, (affinity.get(exercise.id) ?? 0) + entry.weight);
    }
  }

  const weekdayProfile = weekdays.map((day) => {
    const load = {};
    for (const [key, weight] of day.machines) {
      addMuscleLoad(load, matchedByMachine.get(key) ?? [], weight);
    }
    return { sessions: day.sessions, muscleLoad: load };
  });

  // 2b. Past routines: exercises they repeat, weekday habits, their own sets x reps.
  const exerciseById = new Map(catalog.map((exercise) => [exercise.id, exercise]));
  const routineFreq = new Map(); // exercise id -> recency-weighted count
  const weekdayFreq = Array.from({ length: 7 }, () => new Map());
  const lastPrescription = new Map(); // exercise id -> { sets, reps } of its latest use
  const routineMinutes = [];
  const routineDates = new Set();
  let routineWeight = 0;

  for (const day of pastRoutines) {
    const items = (Array.isArray(day.exercises) ? day.exercises : []).filter((item) =>
      exerciseById.has(item.exerciseId)
    );
    if (items.length === 0) continue;

    const weekday = weekdayOf(day.date);
    const [y, m, d] = day.date.split("-").map(Number);
    const ageDays = Math.max(0, (now.getTime() - new Date(y, m - 1, d).getTime()) / DAY_MS);
    const weight = 0.5 ** (ageDays / RECENCY_HALF_LIFE_DAYS);

    weekdayProfile[weekday].sessions += 1;
    routineDates.add(day.date);
    routineMinutes.push(sum(items.map((item) => Number(item.sets) || 0)) * MINUTES_PER_SET);

    for (const item of items) {
      const exercise = exerciseById.get(item.exerciseId);
      routineFreq.set(item.exerciseId, (routineFreq.get(item.exerciseId) ?? 0) + weight);
      weekdayFreq[weekday].set(item.exerciseId, (weekdayFreq[weekday].get(item.exerciseId) ?? 0) + weight);
      lastPrescription.set(item.exerciseId, { sets: Number(item.sets), reps: String(item.reps) }); // ascending: latest wins
      routineWeight += weight;

      const muscles = exercise.muscles ?? [];
      for (const muscle of muscles) {
        const share = weight / muscles.length;
        muscleLoad[muscle] = (muscleLoad[muscle] ?? 0) + share;
        weekdayProfile[weekday].muscleLoad[muscle] = (weekdayProfile[weekday].muscleLoad[muscle] ?? 0) + share;
      }
    }
  }

  const machineLearned = !optedOut && sessions.length >= MIN_SESSIONS_FOR_LEARNING && mappedWeight > 0;
  const routineLearned = routineDates.size >= MIN_ROUTINES_FOR_LEARNING && routineWeight > 0;
  const learned = machineLearned || routineLearned;

  // 3. Favoured / neglected muscles (only meaningful when we learned something).
  const strengthTotal = sum(STRENGTH_MUSCLES.map((m) => muscleLoad[m] ?? 0));
  const favoredMuscles = learned
    ? STRENGTH_MUSCLES.filter((m) => (muscleLoad[m] ?? 0) > 0).sort(
        (a, b) => muscleLoad[b] - muscleLoad[a]
      ).slice(0, 3)
    : [];
  const neglectedMuscles = learned && strengthTotal > 0
    ? STRENGTH_MUSCLES.filter((m) => (muscleLoad[m] ?? 0) / strengthTotal < 0.05)
    : [];

  // 4. Recurring routine (already detected by behaviorAnalysis) -> exercises.
  const recurring = machineLearned ? patterns?.routines?.[0] ?? null : null;
  const patternExerciseIds = new Set();
  if (recurring) {
    for (const machineName of recurring.signature ?? []) {
      for (const exercise of catalog) {
        if (machineMatchesExercise(machineName, exercise.machineKeywords)) {
          patternExerciseIds.add(exercise.id);
        }
      }
    }
  }

  // 5. Weekly frequency and session length.
  const declaredDays = FREQUENCY_TO_DAYS[user.weeklyTrainingDays] ?? null;
  const observedDays =
    machineLearned &&
    sessions.length >= MIN_SESSIONS_FOR_FREQUENCY &&
    patterns?.avgSessionsPerWeek != null
      ? Math.round(patterns.avgSessionsPerWeek)
      : null;
  const routineDays =
    routineLearned && routineDates.size >= MIN_ROUTINES_FOR_FREQUENCY
      ? Math.round(routineDates.size / new Set([...routineDates].map(weekStartKey)).size)
      : null;
  const daysPerWeek = clamp(observedDays ?? routineDays ?? declaredDays ?? 3, 1, 6);

  let sessionMinutes = DEFAULT_SESSION_MINUTES;
  if (durations.length >= 3) sessionMinutes = clamp(Math.round(sum(durations) / durations.length), 30, 90);
  else if (routineMinutes.length >= 3) sessionMinutes = clamp(Math.round(sum(routineMinutes) / routineMinutes.length), 30, 90);

  return {
    level,
    goal,
    trainingType,
    optedOut,
    learned,
    catalog,
    affinity,
    maxAffinity: Math.max(0, ...affinity.values()),
    routineFreq,
    maxRoutineFreq: Math.max(0, ...routineFreq.values()),
    weekdayFreq,
    maxWeekdayFreq: weekdayFreq.map((map) => Math.max(0, ...map.values())),
    lastPrescription,
    routinesAnalyzed: routineDates.size,
    frequentExercises: [...routineFreq.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([id]) => exerciseById.get(id).name),
    muscleLoad,
    favoredMuscles,
    neglectedMuscles: new Set(neglectedMuscles),
    patternExerciseIds,
    recentExerciseIds: new Set(recentExerciseIds),
    weekdays: weekdayProfile,
    rotation: SPLITS[daysPerWeek],
    rotationOffset,
    daysPerWeek,
    sessionMinutes,
    sessionsAnalyzed: sessions.length,
    topMachines: [...machines.values()]
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 3)
      .map(({ name, count }) => ({ name, count })),
    recurringRoutine: recurring?.signature ?? null,
    preferredHour: patterns?.preferredHour ?? null,
  };
}

// ---------------------------------------------------------------------------
// Planning (pure): training profile + dates -> days
// ---------------------------------------------------------------------------

function goalFit(exercise, profile) {
  let byGoal;
  if (profile.goal === "GAIN_MUSCLE") byGoal = exercise.category === "STRENGTH" ? 1 : 0.3;
  else if (profile.goal === "LOSE_WEIGHT" || profile.goal === "INCREASE_ENDURANCE") {
    byGoal = exercise.category === "STRENGTH" ? 0.6 : 1;
  } else byGoal = 0.7;

  let byType = 0.6;
  if (profile.trainingType && profile.trainingType !== "MIXED") {
    byType = exercise.category === profile.trainingType ? 1 : 0.3;
  }
  return 0.5 * byGoal + 0.5 * byType;
}

function levelFit(exerciseLevel, userLevel) {
  const diff = (LEVEL_RANK[exerciseLevel] ?? 0) - (LEVEL_RANK[userLevel] ?? 0);
  if (diff === 0) return 1;
  if (diff < 0) return 0.6;
  return diff === 1 ? 0.3 : 0;
}

export function scoreExercise(exercise, profile, usedInBatch = new Set(), weekday = null) {
  const affinity = profile.maxAffinity > 0 ? (profile.affinity.get(exercise.id) ?? 0) / profile.maxAffinity : 0;
  const routine = profile.maxRoutineFreq > 0 ? (profile.routineFreq.get(exercise.id) ?? 0) / profile.maxRoutineFreq : 0;
  const weekdayMax = weekday == null ? 0 : profile.maxWeekdayFreq[weekday];
  const weekdayRoutine = weekdayMax > 0 ? (profile.weekdayFreq[weekday].get(exercise.id) ?? 0) / weekdayMax : 0;
  const balance = (exercise.muscles ?? []).some((m) => profile.neglectedMuscles.has(m)) ? 1 : 0;

  return (
    WEIGHTS.affinity * affinity +
    WEIGHTS.routine * routine +
    WEIGHTS.weekdayRoutine * weekdayRoutine +
    WEIGHTS.pattern * (profile.patternExerciseIds.has(exercise.id) ? 1 : 0) +
    WEIGHTS.goal * goalFit(exercise, profile) +
    WEIGHTS.level * levelFit(exercise.level, profile.level) +
    WEIGHTS.balance * balance -
    WEIGHTS.recentPenalty * (profile.recentExerciseIds.has(exercise.id) ? 1 : 0) -
    WEIGHTS.batchPenalty * (usedInBatch.has(exercise.id) ? 1 : 0)
  );
}

/** Which focus to train on a date: the weekday's learned habit, else the split rotation. */
export function chooseFocus(profile, weekday, rotationIndex) {
  const history = profile.weekdays[weekday];
  if (profile.learned && history.sessions >= MIN_WEEKDAY_SESSIONS) {
    const total = sum(Object.values(history.muscleLoad));
    // Any focus can be learned from a weekday habit (narrowest first, so a pure
    // chest day is PUSH, not UPPER); the rotation only fills in when there is no habit.
    const candidates = HABIT_FOCI;

    if (total > 0 && candidates.length > 0) {
      const shares = candidates.map((focus) => ({
        focus,
        share: sum(FOCUS[focus].map((m) => history.muscleLoad[m] ?? 0)) / total,
      }));
      const top = Math.max(...shares.map((entry) => entry.share));
      // The narrowest focus that still explains most of what they do that day
      // (a mostly-chest day is PUSH even if there was a little back work).
      const pick = shares.find((entry) => entry.share >= top * WEEKDAY_FOCUS_RELATIVE_SHARE);
      const best = pick?.focus ?? null;
      const bestShare = pick?.share ?? 0;
      if (best && bestShare >= WEEKDAY_FOCUS_MIN_SHARE) {
        return { focus: best, basedOn: "WEEKDAY_PATTERN" };
      }
    }
  }
  return { focus: profile.rotation[rotationIndex % profile.rotation.length], basedOn: "ROTATION" };
}

function prescriptionFor(exercise, profile) {
  // Same sets x reps the member used the last time they did this exercise.
  const own = profile.lastPrescription.get(exercise.id);
  if (own && Number.isInteger(own.sets) && own.sets >= 1 && own.sets <= 8 && own.reps) return own;

  const muscles = exercise.muscles ?? [];
  // Cardio and core work keep the catalog's own prescription (minutes / holds).
  if (muscles.includes("cardio") || muscles.includes("core")) {
    return { sets: exercise.defaultSets, reps: exercise.defaultReps };
  }
  const base = SCHEMES[profile.goal];
  let sets = base.sets;
  if (profile.level === "BEGINNER") sets = Math.min(sets, 3);
  if (profile.level === "ADVANCED") sets = Math.min(5, sets + 1);
  return { sets, reps: base.reps };
}

function cardioSlots(profile) {
  if (profile.trainingType === "CARDIO") return 2;
  const wantsCardio =
    profile.goal === "LOSE_WEIGHT" ||
    profile.goal === "INCREASE_ENDURANCE" ||
    profile.trainingType === "MIXED";
  return wantsCardio ? 1 : 0;
}

function musclePriority(muscle) {
  const index = MUSCLE_ORDER.indexOf(muscle);
  return index === -1 ? MUSCLE_ORDER.length : index;
}

const focusCoverage = (exercise, focusMuscles) =>
  (exercise.muscles ?? []).filter((m) => focusMuscles.includes(m)).length;

function pickStrength(candidates, focusMuscles, count, profile, usedInBatch, weekday) {
  const scored = candidates
    .map((exercise) => ({ exercise, score: scoreExercise(exercise, profile, usedInBatch, weekday) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        focusCoverage(b.exercise, focusMuscles) - focusCoverage(a.exercise, focusMuscles) ||
        a.exercise.name.localeCompare(b.exercise.name)
    );

  const primaryOf = (exercise) => exercise.muscles.find((m) => focusMuscles.includes(m));
  const picked = [];
  const pickedIds = new Set();
  const perMuscle = {};

  const take = (entry) => {
    picked.push(entry);
    pickedIds.add(entry.exercise.id);
    const primary = primaryOf(entry.exercise);
    perMuscle[primary] = (perMuscle[primary] ?? 0) + 1;
  };

  // 1) Coverage: make sure each focus muscle the member trains is worked,
  //    most-trained first. A muscle already hit by a picked exercise counts as
  //    covered, and once we've learned from them we don't force muscles they never do.
  const covered = new Set();
  const orderedMuscles = [...focusMuscles].sort(
    (a, b) =>
      (profile.muscleLoad[b] ?? 0) - (profile.muscleLoad[a] ?? 0) ||
      musclePriority(a) - musclePriority(b)
  );
  for (const muscle of orderedMuscles) {
    if (picked.length >= count) break;
    if (covered.has(muscle)) continue;
    if (profile.learned && (profile.muscleLoad[muscle] ?? 0) === 0) continue;
    const entry = scored.find((e) => !pickedIds.has(e.exercise.id) && e.exercise.muscles.includes(muscle));
    if (entry) {
      take(entry);
      entry.exercise.muscles.forEach((m) => covered.add(m));
    }
  }

  // 2) Fill by score, without letting one muscle take over the day.
  const cap = Math.ceil(count / focusMuscles.length) + 1;
  for (const entry of scored) {
    if (picked.length >= count) break;
    if (pickedIds.has(entry.exercise.id)) continue;
    if ((perMuscle[primaryOf(entry.exercise)] ?? 0) >= cap) continue;
    take(entry);
  }

  // 3) Still short (small catalog): fill ignoring the cap.
  for (const entry of scored) {
    if (picked.length >= count) break;
    if (!pickedIds.has(entry.exercise.id)) take(entry);
  }

  // Big muscle groups first, then best score.
  return picked
    .sort(
      (a, b) =>
        musclePriority(primaryOf(a.exercise)) - musclePriority(primaryOf(b.exercise)) ||
        b.score - a.score
    )
    .map((entry) => entry.exercise);
}

/** Exercises (with sets/reps) for one day of the given focus. */
export function planDay(profile, focus, usedInBatch = new Set(), weekday = null) {
  const focusMuscles = FOCUS[focus];
  const cardioCount = cardioSlots(profile);
  const target = clamp(Math.round(profile.sessionMinutes / MINUTES_PER_EXERCISE), 4, 8);
  const strengthCount = Math.max(3, target - cardioCount);

  const strengthPool = profile.catalog.filter((e) => !isCardio(e));
  let candidates = strengthPool.filter((e) => (e.muscles ?? []).some((m) => focusMuscles.includes(m)));
  // Catalog without that muscle group: don't return an empty day.
  if (candidates.length === 0) candidates = strengthPool.filter((e) => (e.muscles ?? []).length > 0);

  const strength = pickStrength(candidates, focusMuscles, strengthCount, profile, usedInBatch, weekday);

  const cardio = profile.catalog
    .filter(isCardio)
    .map((exercise) => ({ exercise, score: scoreExercise(exercise, profile, usedInBatch, weekday) }))
    .sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name))
    .slice(0, cardioCount)
    .map((entry) => entry.exercise);

  return [...strength, ...cardio].map((exercise) => ({
    exerciseId: exercise.id,
    ...prescriptionFor(exercise, profile),
  }));
}

/** Plans every requested date (ascending). */
export function planDays(profile, dates, language = "es") {
  const lang = language === "en" ? "en" : "es";
  const usedInBatch = new Set();

  return dates.map((date, index) => {
    const weekday = weekdayOf(date);
    const { focus, basedOn } = chooseFocus(profile, weekday, index + profile.rotationOffset);
    const exercises = planDay(profile, focus, usedInBatch, weekday);
    exercises.forEach((item) => usedInBatch.add(item.exerciseId));
    return { date, focus, basedOn, title: FOCUS_TITLES[focus][lang], exercises };
  });
}

/** Human-readable (structured) summary of what the engine learned. */
export function describeProfile(profile) {
  let reason = null;
  if (!profile.learned) reason = profile.optedOut ? "TRACKING_OPT_OUT" : "NOT_ENOUGH_HISTORY";

  return {
    mode: profile.learned ? "LEARNED" : "PROFILE_ONLY",
    reason,
    sessionsAnalyzed: profile.sessionsAnalyzed,
    routinesAnalyzed: profile.routinesAnalyzed,
    frequentExercises: profile.frequentExercises,
    windowDays: HISTORY_WINDOW_DAYS,
    goal: profile.goal,
    level: profile.level,
    trainingType: profile.trainingType,
    daysPerWeek: profile.daysPerWeek,
    sessionMinutes: profile.sessionMinutes,
    topMachines: profile.topMachines,
    favoredMuscles: profile.favoredMuscles,
    neglectedMuscles: [...profile.neglectedMuscles],
    recurringRoutine: profile.recurringRoutine,
    preferredHour: profile.preferredHour,
  };
}

// ---------------------------------------------------------------------------
// DB layer
// ---------------------------------------------------------------------------

/** Reads everything the engine needs from the database. */
export async function loadGeneratorInput(userId, dates, now = new Date()) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { trainingLevel: true, objectives: true, weeklyTrainingDays: true, trainingType: true },
  });
  if (!user) throw new AppError("User not found", 404);

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { machineTrackingOptOut: true },
  });
  // Same privacy rule as getPatternSuggestion: opted-out members get nothing learned from machine usage.
  const optedOut = Boolean(settings?.machineTrackingOptOut);

  const since = new Date(now.getTime() - HISTORY_WINDOW_DAYS * DAY_MS);
  const noveltySince = dateKeyOf(new Date(now.getTime() - NOVELTY_WINDOW_DAYS * DAY_MS));

  const [catalog, recentDays] = await Promise.all([
    prisma.exercise.findMany({
      where: { active: true, OR: [{ isCustom: false }, { createdById: userId }] },
    }),
    // The member's own routines (saved days) of the analysed window.
    prisma.scheduleDay.findMany({
      where: { userId, date: { gte: dateKeyOf(since) } },
      select: { date: true, exercises: true },
      orderBy: { date: "asc" },
    }),
  ]);

  let sessions = [];
  let patterns = null;
  if (!optedOut) {
    [sessions, patterns] = await Promise.all([
      prisma.gymSession.findMany({
        where: { userId, checkInAt: { gte: since } },
        include: { machineUsages: { include: { machine: { select: { name: true } } } } },
        orderBy: { checkInAt: "asc" },
      }),
      analyzeUserPatterns(userId),
    ]);
  }

  // Days about to be overwritten don't count as history.
  const others = recentDays.filter((row) => !dates.includes(row.date));
  const recent = others.filter((row) => row.date >= noveltySince);
  const todayKey = dateKeyOf(now);
  const pastRoutines = others.filter((row) => row.date <= todayKey);
  const recentExerciseIds = recent.flatMap((row) =>
    (Array.isArray(row.exercises) ? row.exercises : []).map((item) => item.exerciseId)
  );

  return {
    user,
    optedOut,
    catalog,
    sessions,
    patterns,
    pastRoutines,
    recentExerciseIds,
    rotationOffset: recent.length,
    now,
  };
}

function normalizeDates(dates) {
  if (!Array.isArray(dates) || dates.length === 0) {
    throw new AppError("dates must be a non-empty array of YYYY-MM-DD", 400);
  }
  const unique = [...new Set(dates)];
  if (unique.length > MAX_DATES_PER_REQUEST) {
    throw new AppError(`Cannot generate more than ${MAX_DATES_PER_REQUEST} days at once`, 400);
  }
  unique.forEach((date) => assertDateKey(date, "dates[]"));
  return unique.sort();
}

/**
 * Generates (and by default saves) personalized routines for the given days.
 * Returns { days, analysis }: each day has the same shape as the schedule API
 * plus `focus` and `basedOn` ("WEEKDAY_PATTERN" | "ROTATION").
 */
export async function generateRoutines(userId, { dates, language = "es", save = true, now = new Date() }) {
  const sortedDates = normalizeDates(dates);

  const input = await loadGeneratorInput(userId, sortedDates, now);
  if (input.catalog.length === 0) {
    throw new AppError("The exercise catalog is empty. Run the seed first.", 409);
  }

  const profile = buildTrainingProfile(input);
  const plan = planDays(profile, sortedDates, language);
  const exerciseMap = new Map(input.catalog.map((exercise) => [exercise.id, serializeExercise(exercise)]));

  let rows;
  if (save) {
    rows = await prisma.$transaction(
      plan.map((day) => {
        const payload = {
          title: day.title,
          exercises: day.exercises,
          source: "AI",
          generalRoutineId: null,
        };
        return prisma.scheduleDay.upsert({
          where: { userId_date: { userId, date: day.date } },
          create: { userId, date: day.date, ...payload },
          update: payload,
        });
      })
    );
  } else {
    rows = plan.map((day) => ({
      id: null,
      date: day.date,
      title: day.title,
      source: "AI",
      generalRoutineId: null,
      exercises: day.exercises,
    }));
  }

  const days = rows.map((row, index) => ({
    ...toDayDto(row, exerciseMap),
    focus: plan[index].focus,
    basedOn: plan[index].basedOn,
  }));

  return {
    days,
    analysis: describeProfile(profile),
    saved: save,
  };
}
