// src/constants/exercises.js
//
// Default exercises offered by the app on the "Seleccionar ejercicio" screen.
// Names/descriptions are NOT stored here: they live in the i18n files under
// `user.routines.exercises.<id>.{name,description}`.
//
// Images: every exercise points to `assets/exercise_<id>.png`. Right now those
// files are copies of Rectangle 75.png; just replace each file with the real
// photo (same file name, square, ~120x120 or bigger) and no code changes are needed.

export const MUSCLE_GROUPS = {
  CHEST: 'chest',
  TRICEPS: 'triceps',
};

export const DEFAULT_SETS = 3;
export const DEFAULT_REPS = '10-12';

export const DEFAULT_EXERCISES = [
  {
    id: 'declinePress',
    muscles: [MUSCLE_GROUPS.CHEST],
    sets: 4,
    reps: '8-10',
    image: require('../assets/exercise_declinePress.png'),
  },
  {
    id: 'declineFlyes',
    muscles: [MUSCLE_GROUPS.CHEST],
    sets: 3,
    reps: '10-12',
    image: require('../assets/exercise_declineFlyes.png'),
  },
  {
    id: 'parallelDips',
    muscles: [MUSCLE_GROUPS.CHEST, MUSCLE_GROUPS.TRICEPS],
    sets: 3,
    reps: '10-12',
    image: require('../assets/exercise_parallelDips.png'),
  },
  {
    id: 'closeGripPress',
    muscles: [MUSCLE_GROUPS.TRICEPS],
    sets: 3,
    reps: '10-12',
    image: require('../assets/exercise_closeGripPress.png'),
  },
  {
    id: 'cablePushdown',
    muscles: [MUSCLE_GROUPS.TRICEPS],
    sets: 3,
    reps: '10-12',
    image: require('../assets/exercise_cablePushdown.png'),
  },
  {
    id: 'skullCrushers',
    muscles: [MUSCLE_GROUPS.TRICEPS],
    sets: 3,
    reps: '10-12',
    image: require('../assets/exercise_skullCrushers.png'),
  },
];
