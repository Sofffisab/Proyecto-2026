// src/context/RoutinesContext.js
//
// Frontend-only store for the weekly routine schedule ("Tu cronograma"):
//   - schedule:        { [dateKey]: { title, exercises: [{ id, sets, reps }] } }
//   - customExercises: exercises created by the person (name, description, photo)
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

const STORAGE_KEY_PREFIX = '@gymapp/routines';

const RoutinesContext = createContext({
  schedule: {},
  customExercises: [],
  draft: null,
  getDay: () => null,
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
      } catch {
        if (cancelled) return;
        setSchedule({});
        setCustomExercises([]);
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
    AsyncStorage.setItem(storageKey, JSON.stringify({ schedule, customExercises })).catch(() => {});
  }, [isLoaded, schedule, customExercises, storageKey]);

  const getDay = useCallback((dateKey) => schedule[dateKey] ?? null, [schedule]);

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
      getDay,
      getExercise,
      addCustomExercise,
      openDraft,
      updateDraft,
      addToDraft,
      discardDraft,
      saveDraft,
      generateWithAi,
    }),
    [schedule, customExercises, draft, getDay, getExercise, addCustomExercise, openDraft, updateDraft, addToDraft, discardDraft, saveDraft, generateWithAi]
  );

  return <RoutinesContext.Provider value={value}>{children}</RoutinesContext.Provider>;
}

export function useRoutines() {
  return useContext(RoutinesContext);
}

export default RoutinesContext;
