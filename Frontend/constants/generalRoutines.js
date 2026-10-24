// src/constants/generalRoutines.js
//
// The general ("default") routines now come from the database
// (GET /routines/general). Only the UI option keys remain here.

// Which routine the Routines screen follows.
export const ROUTINE_OPTIONS = {
  MY_ROUTINES: 'myRoutines',
  GENERAL_ROUTINES: 'generalRoutines',
  NO_ROUTINE: 'noRoutine',
};

// Where the routine shown by the free-mode / step-by-step screens comes from.
export const ROUTINE_SOURCES = {
  SCHEDULE: 'schedule', // today's entry of "mis rutinas"
  GENERAL: 'general', // one of the general routines (DB)
  NONE: 'none', // "no seguir rutina": nothing but the camera
};
