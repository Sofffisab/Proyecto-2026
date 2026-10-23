// src/context/RoutinesContext.js
//
// Frontend-only store for the weekly routine schedule ("Tu cronograma"):
//   - schedule:        { [dateKey]: { title, exercises: [{ id, sets, reps }] } }
//   - customExercises: exercises created by the person (name, description, photo)
//   - routineOption:   which option the Routines screen follows
//   - generalChoices:  { [dateKey]: generalRoutineId } default routine picked for a day
//   - completedGeneral:{ [generalRoutineId]: times finished } (drives the random pick)
//   - draft:           the day currently being edited on the day screen
//                      (shared with the "Seleccionar ejercicio" screen)
//
// There's no Backend resource for this yet, so it's persisted per user in
// AsyncStorage (same approach as AuthContext). Swap the load/persist calls
// for API calls when the endpoints exist.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { DEFAULT_EXERCISES, DEFAULT_SETS, DEFAULT_REPS } from '../constants/exercises';
import { generatePersonalizedExercises } from '../utils/personalizedRoutine';
import { GENERAL_ROUTINES, ROUTINE_OPTIONS, ROUTINE_SOURCES } from '../constants/generalRoutines';

const STORAGE_KEY_PREFIX = '@gymapp/routines';

const RoutinesContext = createContext({
  schedule: {},
  customExercises: [],
  draft: null,
  routineOption: ROUTINE_OPTIONS.MY_ROUTINES,
  setRoutineOption: () => {},
  getDay: () => null,
  getRoutine: () => null,
  getGeneralChoice: () => null,
  chooseGeneralRoutine: () => {},
  assignRandomGeneralRoutine: () => null,
  completeGeneralRoutine: () => {},
  getExercise: () => null,
  addCustomExercise: () => null,
  openDraft: () => {},
  updateDraft: () => {},
  addToDraft: () => {},
  discardDraft: () => {},
  saveDraft: () => {},
  generateWithAi: () => {},
});

export function RoutinesProvider({ children }) {
  const { user } = useAuth();
  const storageKey = `${STORAGE_KEY_PREFIX}/${user?.id ?? 'anonymous'}`;

  const [isLoaded, setIsLoaded] = useState(false);
  const [schedule, setSchedule] = useState({});
  const [customExercises, setCustomExercises] = useState([]);
  const [draft, setDraft] = useState(null);
  const [routineOption, setRoutineOption] = useState(ROUTINE_OPTIONS.MY_ROUTINES);
  const [generalChoices, setGeneralChoices] = useState({});
  const [completedGeneral, setCompletedGeneral] = useState({});

  // Restore the saved schedule whenever the signed-in user changes.
  useEffect(() => {
    let cancelled = false;
    setIsLoaded(false);
    setDraft(null);
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        const saved = raw ? JSON.parse(raw) : null;
        if (cancelled) return;
        setSchedule(saved?.schedule ?? {});
        setCustomExercises(saved?.customExercises ?? []);
        setRoutineOption(saved?.routineOption ?? ROUTINE_OPTIONS.MY_ROUTINES);
        setGeneralChoices(saved?.generalChoices ?? {});
        setCompletedGeneral(saved?.completedGeneral ?? {});
      } catch {
        if (cancelled) return;
        setSchedule({});
        setCustomExercises([]);
        setRoutineOption(ROUTINE_OPTIONS.MY_ROUTINES);
        setGeneralChoices({});
        setCompletedGeneral({});
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(
      storageKey,
      JSON.stringify({ schedule, customExercises, routineOption, generalChoices, completedGeneral })
    ).catch(() => {});
  }, [isLoaded, schedule, customExercises, routineOption, generalChoices, completedGeneral, storageKey]);

  const getDay = useCallback((dateKey) => schedule[dateKey] ?? null, [schedule]);

  const getGeneralChoice = useCallback((dateKey) => generalChoices[dateKey] ?? null, [generalChoices]);

  // Picks the default routine for a day and makes "rutinas generales" the
  // followed option.
  const chooseGeneralRoutine = useCallback((dateKey, routineId) => {
    setGeneralChoices((prev) => ({ ...prev, [dateKey]: routineId }));
    setRoutineOption(ROUTINE_OPTIONS.GENERAL_ROUTINES);
  }, []);

  // Nothing chosen yet: assign one at random, but only among the default
  // routines finished the fewest times (so ones never done come first).
  const assignRandomGeneralRoutine = useCallback(
    (dateKey) => {
      const counts = GENERAL_ROUTINES.map((r) => completedGeneral[r.id] ?? 0);
      const fewest = Math.min(...counts);
      const candidates = GENERAL_ROUTINES.filter((r, i) => counts[i] === fewest);
      const picked = candidates[Math.floor(Math.random() * candidates.length)];
      setGeneralChoices((prev) => ({ ...prev, [dateKey]: picked.id }));
      return picked.id;
    },
    [completedGeneral]
  );

  const completeGeneralRoutine = useCallback((routineId) => {
    setCompletedGeneral((prev) => ({ ...prev, [routineId]: (prev[routineId] ?? 0) + 1 }));
  }, []);

  // Resolves the routine behind a route's params ({ source, dateKey, generalRoutineId }).
  // Returns { title | titleKey, exercises } or null when there is none.
  const getRoutine = useCallback(
    ({ source, dateKey, generalRoutineId } = {}) => {
      if (source === ROUTINE_SOURCES.GENERAL) {
        return GENERAL_ROUTINES.find((r) => r.id === generalRoutineId) ?? null;
      }
      if (source === ROUTINE_SOURCES.SCHEDULE) return schedule[dateKey] ?? null;
      return null;
    },
    [schedule]
  );

  // Looks an exercise up by id among the defaults and the person's own ones.
  const getExercise = useCallback(
    (id) => DEFAULT_EXERCISES.find((ex) => ex.id === id) ?? customExercises.find((ex) => ex.id === id) ?? null,
    [customExercises]
  );

  const addCustomExercise = useCallback((exercise) => {
    const created = {
      id: `custom-${Date.now()}`,
      isCustom: true,
      muscles: [],
      sets: DEFAULT_SETS,
      reps: DEFAULT_REPS,
      ...exercise,
    };
    setCustomExercises((prev) => [...prev, created]);
    return created;
  }, []);

  const openDraft = useCallback(
    (dateKey) => {
      const day = schedule[dateKey];
      setDraft({
        dateKey,
        title: day?.title ?? '',
        exercises: day?.exercises ?? [],
      });
    },
    [schedule]
  );

  const updateDraft = useCallback((patch) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  // `exerciseIds` come from the selector; new ones go to the end of the day.
  const addToDraft = useCallback(
    (exerciseIds) => {
      setDraft((prev) => {
        if (!prev) return prev;
        const added = exerciseIds
          .map((id) => getExercise(id))
          .filter(Boolean)
          .map((ex) => ({ id: ex.id, sets: ex.sets, reps: ex.reps }));
        return { ...prev, exercises: [...prev.exercises, ...added] };
      });
    },
    [getExercise]
  );

  const discardDraft = useCallback(() => setDraft(null), []);

  const saveDraft = useCallback(() => {
    if (!draft) return;
    setSchedule((prev) => {
      const next = { ...prev };
      if (draft.exercises.length === 0 && !draft.title.trim()) delete next[draft.dateKey];
      else next[draft.dateKey] = { title: draft.title.trim(), exercises: draft.exercises };
      return next;
    });
    setDraft(null);
  }, [draft]);

  // "Personalized AI" (static for now, see utils/personalizedRoutine.js):
  // fills every given day with a generated routine.
  const generateWithAi = useCallback((dateKeys, title) => {
    setSchedule((prev) => {
      const next = { ...prev };
      dateKeys.forEach((dateKey) => {
        next[dateKey] = { title, exercises: generatePersonalizedExercises() };
      });
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      schedule,
      customExercises,
      draft,
      routineOption,
      setRoutineOption,
      getDay,
      getRoutine,
      getGeneralChoice,
      chooseGeneralRoutine,
      assignRandomGeneralRoutine,
      completeGeneralRoutine,
      getExercise,
      addCustomExercise,
      openDraft,
      updateDraft,
      addToDraft,
      discardDraft,
      saveDraft,
      generateWithAi,
    }),
    [schedule, customExercises, draft, routineOption, getRoutine, getGeneralChoice, chooseGeneralRoutine, assignRandomGeneralRoutine, completeGeneralRoutine, getDay, getExercise, addCustomExercise, openDraft, updateDraft, addToDraft, discardDraft, saveDraft, generateWithAi]
  );

  return <RoutinesContext.Provider value={value}>{children}</RoutinesContext.Provider>;
}

export function useRoutines() {
  return useContext(RoutinesContext);
}

export default RoutinesContext;
