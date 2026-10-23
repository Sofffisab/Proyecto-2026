// src/utils/personalizedRoutine.js
//
// STATIC placeholder for the "personalized AI" routine. There's no Backend
// endpoint for it yet, so this just returns the app's default exercises.
// When the real endpoint exists, replace the body of this function (keep the
// returned shape: an array of { id, sets, reps }) and nothing else changes.

import { DEFAULT_EXERCISES } from '../constants/exercises';

export function generatePersonalizedExercises() {
  return DEFAULT_EXERCISES.slice(0, 5).map(({ id, sets, reps }) => ({ id, sets, reps }));
}
