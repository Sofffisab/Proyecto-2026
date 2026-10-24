// src/constants/exercises.js
//
// The exercise catalog now lives in the database (Backend `Exercise` table,
// loaded with `prisma db seed`) and is fetched through RoutinesContext.
// Only UI constants remain here.

export const MUSCLE_GROUPS = {
  CHEST: 'chest',
  TRICEPS: 'triceps',
  BACK: 'back',
  BICEPS: 'biceps',
  SHOULDERS: 'shoulders',
  LEGS: 'legs',
  GLUTES: 'glutes',
  CORE: 'core',
  CARDIO: 'cardio',
};

export const DEFAULT_SETS = 3;
export const DEFAULT_REPS = '10-12';
