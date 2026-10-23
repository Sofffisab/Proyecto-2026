// src/constants/generalRoutines.js
//
// Default ("general") routines the person can follow instead of their own.
// FRONTEND STAND-IN: there is no Backend endpoint for default routines yet, so
// they live here. When the DB resource exists, fetch the list instead and keep
// the same shape ({ id, titleKey, exercises: [{ id, sets, reps }] }).
// Titles come from i18n: `user.routines.general.<id>.title`.

import { DEFAULT_EXERCISES } from './exercises';

// Which routine the Routines screen follows.
export const ROUTINE_OPTIONS = {
  MY_ROUTINES: 'myRoutines',
  GENERAL_ROUTINES: 'generalRoutines',
  NO_ROUTINE: 'noRoutine',
};

// Where the routine shown by the free-mode / step-by-step screens comes from.
export const ROUTINE_SOURCES = {
  SCHEDULE: 'schedule', // today's entry of "mis rutinas"
  GENERAL: 'general', // one of GENERAL_ROUTINES
  NONE: 'none', // "no seguir rutina": nothing but the camera
};

const fromIds = (ids) =>
  ids.map((id) => {
    const { sets, reps } = DEFAULT_EXERCISES.find((ex) => ex.id === id);
    return { id, sets, reps };
  });

export const GENERAL_ROUTINES = [
  {
    id: 'chestDay',
    titleKey: 'user.routines.general.chestDay.title',
    exercises: fromIds(['declinePress', 'declineFlyes', 'parallelDips']),
  },
  {
    id: 'tricepsDay',
    titleKey: 'user.routines.general.tricepsDay.title',
    exercises: fromIds(['parallelDips', 'closeGripPress', 'cablePushdown', 'skullCrushers']),
  },
  {
    id: 'chestTriceps',
    titleKey: 'user.routines.general.chestTriceps.title',
    exercises: fromIds(['declinePress', 'declineFlyes', 'parallelDips', 'closeGripPress', 'cablePushdown', 'skullCrushers']),
  },
  {
    id: 'upperExpress',
    titleKey: 'user.routines.general.upperExpress.title',
    exercises: fromIds(['declinePress', 'parallelDips', 'cablePushdown']),
  },
];
