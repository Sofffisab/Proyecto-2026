// src/context/RoutinesContext.js
//
// Store for everything the Routines screens need. The DATA comes from the
// Backend/database (see features/api/services/routine.api.js):
//   - exercises:       exercise catalog (built-in + the person's own)
//   - generalRoutines: "rutinas generales" list; each one's exercises are
//                      fetched when it is opened (step by step, day editor...)
//   - schedule:        the weekly schedule ("Tu cronograma"): one saved day
//                      per date, with its title and exercises
//   - draft:           the day currently being edited on the day screen
//                      (shared with the "Seleccionar ejercicio" screen);
//                      "Guardar" writes it to the database
// Only small UI preferences stay on the device (AsyncStorage):
//   routineOption (which option the Routines screen follows), generalChoices
//   (default routine picked per day) and completedGeneral (drives the random pick).
//
// Exercises/routines are exposed already localized (name/title in the active
// language) and with the shape { id, sets, reps } for routine items.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { useTranslation } from '../i18n/I18nContext';
import * as routineApi from '../features/api/services/routine.api';
import { EXERCISE_IMAGES } from '../constants/exerciseImages';
import { ROUTINE_OPTIONS, ROUTINE_SOURCES } from '../constants/generalRoutines';
import { estimateMinutes } from '../utils/schedule';

const STORAGE_KEY_PREFIX = '@gymapp/routine-prefs';

const noop = () => {};
const asyncNoop = async () => null;

const RoutinesContext = createContext({
  exercises: [],
  muscleGroups: [],
  generalRoutines: [],
  catalogStatus: { loading: false, error: null },
  generalStatus: { loading: false, error: null },
  draft: null,
  routineOption: ROUTINE_OPTIONS.MY_ROUTINES,
  setRoutineOption: noop,
  loadCatalog: asyncNoop,
  loadGeneralRoutines: asyncNoop,
  loadGeneralRoutine: asyncNoop,
  loadWeek: asyncNoop,
  loadDay: asyncNoop,
  loadRoutine: asyncNoop,
  getDay: () => null,
  getRoutine: () => null,
  getGeneralChoice: () => null,
  chooseGeneralRoutine: noop,
  assignRandomGeneralRoutine: () => null,
  completeGeneralRoutine: noop,
  getExercise: () => null,
  addCustomExercise: asyncNoop,
  openDraft: asyncNoop,
  updateDraft: noop,
  addToDraft: noop,
  applyGeneralRoutineToDraft: asyncNoop,
  discardDraft: noop,
  saveDraft: asyncNoop,
  generateWithAi: asyncNoop,
});

// -- normalizers -------------------------------------------------------------

const pickText = (language, es, en) => (language === 'en' ? en || es : es || en) ?? '';

function localizeExercise(raw, language) {
  return {
    id: raw.id,
    slug: raw.slug ?? null,
    name: pickText(language, raw.name, raw.nameEn),
    description: pickText(language, raw.description, raw.descriptionEn),
    muscles: raw.muscles ?? [],
    sets: raw.sets,
    reps: raw.reps,
    isCustom: Boolean(raw.isCustom),
    // Bundled photo (by slug) or the exercise's own picture.
    imageSource: (raw.slug && EXERCISE_IMAGES[raw.slug]) || (raw.imageUrl ? { uri: raw.imageUrl } : null),
  };
}

// API day -> { title, source, generalRoutineId, exercises: [{ id, sets, reps }], ... }
function normalizeDay(day) {
  const exercises = (day.exercises ?? []).map((item) => ({
    id: item.exerciseId,
    sets: item.sets,
    reps: item.reps,
  }));
  return {
    title: day.title ?? '',
    source: day.source ?? 'MANUAL',
    generalRoutineId: day.generalRoutineId ?? null,
    exercises,
    exerciseCount: exercises.length,
    estimatedMinutes: day.estimatedMinutes ?? estimateMinutes(exercises),
  };
}

function normalizeGeneral(detail, language) {
  const exercises = (detail.exercises ?? []).map((item) => ({
    id: item.exerciseId,
    sets: item.sets,
    reps: item.reps,
  }));
  return {
    id: detail.id,
    title: pickText(language, detail.title, detail.titleEn),
    exercises,
    exerciseCount: exercises.length,
    estimatedMinutes: detail.estimatedMinutes ?? estimateMinutes(exercises),
  };
}

const errorMessage = (err) => err?.message || 'Something went wrong';

export function RoutinesProvider({ children }) {
  const { user } = useAuth();
  const { language } = useTranslation();
  const userId = user?.id ?? null;
  const storageKey = `${STORAGE_KEY_PREFIX}/${userId ?? 'anonymous'}`;

  // Database data (raw, as the API returns it).
  const [rawExercises, setRawExercises] = useState({}); // id -> raw exercise (catalog + any seen in days)
  const [catalogIds, setCatalogIds] = useState([]);
  const [muscleGroups, setMuscleGroups] = useState([]);
  const [rawGeneralList, setRawGeneralList] = useState([]);
  const [rawGeneralDetails, setRawGeneralDetails] = useState({}); // id -> raw detail
  const [rawSchedule, setRawSchedule] = useState({}); // dateKey -> raw day | null (loaded but empty)
  const [catalogStatus, setCatalogStatus] = useState({ loading: false, error: null });
  const [generalStatus, setGeneralStatus] = useState({ loading: false, error: null });

  // Edit session + device preferences.
  const [draft, setDraft] = useState(null);
  const draftToken = useRef(0);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [routineOption, setRoutineOption] = useState(ROUTINE_OPTIONS.MY_ROUTINES);
  const [generalChoices, setGeneralChoices] = useState({});
  const [completedGeneral, setCompletedGeneral] = useState({});

  // -- device preferences ----------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    setPrefsLoaded(false);
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        const saved = raw ? JSON.parse(raw) : null;
        if (cancelled) return;
        setRoutineOption(saved?.routineOption ?? ROUTINE_OPTIONS.MY_ROUTINES);
        setGeneralChoices(saved?.generalChoices ?? {});
        setCompletedGeneral(saved?.completedGeneral ?? {});
      } catch {
        if (cancelled) return;
        setRoutineOption(ROUTINE_OPTIONS.MY_ROUTINES);
        setGeneralChoices({});
        setCompletedGeneral({});
      } finally {
        if (!cancelled) setPrefsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!prefsLoaded) return;
    AsyncStorage.setItem(storageKey, JSON.stringify({ routineOption, generalChoices, completedGeneral })).catch(() => {});
  }, [prefsLoaded, routineOption, generalChoices, completedGeneral, storageKey]);

  // -- ingestion helpers -----------------------------------------------------

  const mergeExercises = useCallback((list) => {
    const items = (list ?? []).filter(Boolean);
    if (items.length === 0) return;
    setRawExercises((prev) => {
      const next = { ...prev };
      items.forEach((ex) => {
        next[ex.id] = ex;
      });
      return next;
    });
  }, []);

  const ingestDays = useCallback(
    (days, keysWithoutDay = []) => {
      mergeExercises(days.flatMap((day) => (day.exercises ?? []).map((item) => item.exercise)));
      setRawSchedule((prev) => {
        const next = { ...prev };
        keysWithoutDay.forEach((key) => {
          next[key] = null;
        });
        days.forEach((day) => {
          next[day.date] = day;
        });
        return next;
      });
    },
    [mergeExercises]
  );

  // -- loaders (all hit the database) ------------------------------------------

  const loadCatalog = useCallback(async () => {
    setCatalogStatus({ loading: true, error: null });
    try {
      const { data } = await routineApi.getExercises();
      mergeExercises(data.exercises);
      setCatalogIds(data.exercises.map((ex) => ex.id));
      setMuscleGroups(data.muscleGroups ?? []);
      setCatalogStatus({ loading: false, error: null });
      return data.exercises;
    } catch (err) {
      setCatalogStatus({ loading: false, error: errorMessage(err) });
      return null;
    }
  }, [mergeExercises]);

  const loadGeneralRoutines = useCallback(async () => {
    setGeneralStatus({ loading: true, error: null });
    try {
      const { data } = await routineApi.getGeneralRoutines();
      setRawGeneralList(data);
      setGeneralStatus({ loading: false, error: null });
      return data;
    } catch (err) {
      setGeneralStatus({ loading: false, error: errorMessage(err) });
      return null;
    }
  }, []);

  // Fetches a general routine WITH its exercises. Returns the normalized routine.
  const loadGeneralRoutine = useCallback(
    async (id) => {
      const { data } = await routineApi.getGeneralRoutine(id);
      mergeExercises(data.exercises.map((item) => item.exercise));
      setRawGeneralDetails((prev) => ({ ...prev, [data.id]: data, [data.slug]: data }));
      return normalizeGeneral(data, language);
    },
    [mergeExercises, language]
  );

  const loadWeek = useCallback(
    async (dateKeys) => {
      if (!dateKeys?.length) return;
      const { data } = await routineApi.getSchedule(dateKeys[0], dateKeys[dateKeys.length - 1]);
      const withDay = new Set(data.map((day) => day.date));
      ingestDays(data, dateKeys.filter((key) => !withDay.has(key)));
    },
    [ingestDays]
  );

  const loadDay = useCallback(
    async (dateKey) => {
      const { data } = await routineApi.getScheduleDay(dateKey);
      if (data) ingestDays([data]);
      else ingestDays([], [dateKey]);
      return data ? normalizeDay(data) : null;
    },
    [ingestDays]
  );

  // Initial load whenever the signed-in user changes; clears everything on logout.
  useEffect(() => {
    setDraft(null);
    setRawExercises({});
    setCatalogIds([]);
    setRawGeneralList([]);
    setRawGeneralDetails({});
    setRawSchedule({});
    if (!userId) return;
    loadCatalog();
    loadGeneralRoutines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // -- localized views -------------------------------------------------------

  const exerciseMap = useMemo(() => {
    const map = {};
    Object.values(rawExercises).forEach((raw) => {
      map[raw.id] = localizeExercise(raw, language);
    });
    return map;
  }, [rawExercises, language]);

  const exercises = useMemo(
    () => catalogIds.map((id) => exerciseMap[id]).filter(Boolean),
    [catalogIds, exerciseMap]
  );

  const generalRoutines = useMemo(
    () =>
      rawGeneralList.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: pickText(language, r.title, r.titleEn),
        exerciseCount: r.exerciseCount,
        estimatedMinutes: r.estimatedMinutes,
      })),
    [rawGeneralList, language]
  );

  const getExercise = useCallback((id) => exerciseMap[id] ?? null, [exerciseMap]);

  const getDay = useCallback(
    (dateKey) => (rawSchedule[dateKey] ? normalizeDay(rawSchedule[dateKey]) : null),
    [rawSchedule]
  );

  // Resolves the routine behind a route's params ({ source, dateKey, generalRoutineId })
  // from what is already loaded. Use loadRoutine to fetch it from the database first.
  const getRoutine = useCallback(
    ({ source, dateKey, generalRoutineId } = {}) => {
      if (source === ROUTINE_SOURCES.GENERAL) {
        const detail = rawGeneralDetails[generalRoutineId];
        if (detail) return normalizeGeneral(detail, language);
        const summary = generalRoutines.find((r) => r.id === generalRoutineId || r.slug === generalRoutineId);
        // Summary only: title and counts, exercises still to be fetched.
        return summary ? { ...summary, exercises: [] } : null;
      }
      if (source === ROUTINE_SOURCES.SCHEDULE) return getDay(dateKey);
      return null;
    },
    [rawGeneralDetails, generalRoutines, getDay, language]
  );

  // Fetches the selected routine (with its exercises) from the database.
  const loadRoutine = useCallback(
    async ({ source, dateKey, generalRoutineId } = {}) => {
      if (source === ROUTINE_SOURCES.GENERAL && generalRoutineId) return loadGeneralRoutine(generalRoutineId);
      if (source === ROUTINE_SOURCES.SCHEDULE && dateKey) return loadDay(dateKey);
      return null;
    },
    [loadGeneralRoutine, loadDay]
  );

  // -- general routine choice (device preference) ----------------------------

  const getGeneralChoice = useCallback((dateKey) => generalChoices[dateKey] ?? null, [generalChoices]);

  const chooseGeneralRoutine = useCallback((dateKey, routineId) => {
    setGeneralChoices((prev) => ({ ...prev, [dateKey]: routineId }));
    setRoutineOption(ROUTINE_OPTIONS.GENERAL_ROUTINES);
  }, []);

  // Nothing chosen yet: assign one at random among the general routines
  // finished the fewest times (so ones never done come first).
  const assignRandomGeneralRoutine = useCallback(
    (dateKey) => {
      if (rawGeneralList.length === 0) return null;
      const counts = rawGeneralList.map((r) => completedGeneral[r.id] ?? 0);
      const fewest = Math.min(...counts);
      const candidates = rawGeneralList.filter((r, i) => counts[i] === fewest);
      const picked = candidates[Math.floor(Math.random() * candidates.length)];
      setGeneralChoices((prev) => ({ ...prev, [dateKey]: picked.id }));
      return picked.id;
    },
    [rawGeneralList, completedGeneral]
  );

  const completeGeneralRoutine = useCallback((routineId) => {
    setCompletedGeneral((prev) => ({ ...prev, [routineId]: (prev[routineId] ?? 0) + 1 }));
  }, []);

  // -- custom exercises (saved to the database) ------------------------------

  const addCustomExercise = useCallback(
    async ({ name, description, imageUri, muscles }) => {
      const { data } = await routineApi.createExercise({
        name,
        description,
        muscles,
        // Only base64 data URIs / URLs can be stored; a device-local file:// path can't.
        imageUrl: /^(data:image\/|https?:\/\/)/.test(imageUri ?? '') ? imageUri : undefined,
      });
      mergeExercises([data]);
      setCatalogIds((prev) => [...prev, data.id]);
      return localizeExercise(data, language);
    },
    [mergeExercises, language]
  );

  // -- day editing (draft -> database) ---------------------------------------

  // Opens the editor for a day: loads what is saved in the database for it.
  const openDraft = useCallback(
    async (dateKey) => {
      const token = ++draftToken.current;
      setDraft({ dateKey, title: '', exercises: [], source: 'MANUAL', generalRoutineId: null, loading: true, error: null });
      try {
        const day = await loadDay(dateKey);
        if (draftToken.current !== token) return;
        setDraft({
          dateKey,
          title: day?.title ?? '',
          exercises: day?.exercises ?? [],
          source: day?.source ?? 'MANUAL',
          generalRoutineId: day?.generalRoutineId ?? null,
          loading: false,
          error: null,
        });
      } catch (err) {
        if (draftToken.current !== token) return;
        setDraft({ dateKey, title: '', exercises: [], source: 'MANUAL', generalRoutineId: null, loading: false, error: errorMessage(err) });
      }
    },
    [loadDay]
  );

  // Editing the exercises by hand turns the day into a MANUAL one.
  const updateDraft = useCallback((patch) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const manual = 'exercises' in patch ? { source: 'MANUAL', generalRoutineId: null } : {};
      return { ...prev, ...manual, ...patch };
    });
  }, []);

  // `exerciseIds` come from the selector; new ones go to the end of the day.
  const addToDraft = useCallback(
    (exerciseIds) => {
      setDraft((prev) => {
        if (!prev) return prev;
        const added = exerciseIds
          .map((id) => exerciseMap[id])
          .filter(Boolean)
          .map((ex) => ({ id: ex.id, sets: ex.sets, reps: ex.reps }));
        return { ...prev, source: 'MANUAL', generalRoutineId: null, exercises: [...prev.exercises, ...added] };
      });
    },
    [exerciseMap]
  );

  // "Elegir para este día una default": copies a general routine's exercises
  // (fetched from the database) into the day being edited.
  const applyGeneralRoutineToDraft = useCallback(
    async (routineId) => {
      const routine = await loadGeneralRoutine(routineId);
      setDraft((prev) =>
        prev
          ? {
              ...prev,
              title: prev.title.trim() ? prev.title : routine.title.slice(0, 40),
              exercises: routine.exercises,
              source: 'GENERAL',
              generalRoutineId: routine.id,
            }
          : prev
      );
      return routine;
    },
    [loadGeneralRoutine]
  );

  const discardDraft = useCallback(() => {
    draftToken.current += 1;
    setDraft(null);
  }, []);

  // Writes the day to the database. Throws if it fails (the draft is kept).
  const saveDraft = useCallback(async () => {
    if (!draft || draft.loading) return null;
    const { dateKey, title, exercises: items, source, generalRoutineId } = draft;

    if (items.length === 0 && !title.trim()) {
      await routineApi.deleteScheduleDay(dateKey);
      ingestDays([], [dateKey]);
    } else {
      const { data } = await routineApi.saveScheduleDay(dateKey, {
        title: title.trim(),
        exercises: items.map(({ id, sets, reps }) => ({ exerciseId: id, sets: Number(sets), reps: String(reps) })),
        source,
        generalRoutineId,
      });
      ingestDays([data]);
    }
    draftToken.current += 1;
    setDraft(null);
    return true;
  }, [draft, ingestDays]);

  // "Hacer con IA personalizada": the backend analyses the user's history
  // (sessions + machine usage) and saves a routine for every given day.
  const generateWithAi = useCallback(
    async (dateKeys) => {
      const { data } = await routineApi.generateAiRoutines({ dates: dateKeys, language, save: true });
      ingestDays(data.days);
      return data;
    },
    [ingestDays, language]
  );

  const value = useMemo(
    () => ({
      exercises,
      muscleGroups,
      generalRoutines,
      catalogStatus,
      generalStatus,
      draft,
      routineOption,
      setRoutineOption,
      loadCatalog,
      loadGeneralRoutines,
      loadGeneralRoutine,
      loadWeek,
      loadDay,
      loadRoutine,
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
      applyGeneralRoutineToDraft,
      discardDraft,
      saveDraft,
      generateWithAi,
    }),
    [
      exercises, muscleGroups, generalRoutines, catalogStatus, generalStatus, draft, routineOption,
      loadCatalog, loadGeneralRoutines, loadGeneralRoutine, loadWeek, loadDay, loadRoutine,
      getDay, getRoutine, getGeneralChoice, chooseGeneralRoutine, assignRandomGeneralRoutine,
      completeGeneralRoutine, getExercise, addCustomExercise, openDraft, updateDraft, addToDraft,
      applyGeneralRoutineToDraft, discardDraft, saveDraft, generateWithAi,
    ]
  );

  return <RoutinesContext.Provider value={value}>{children}</RoutinesContext.Provider>;
}

export function useRoutines() {
  return useContext(RoutinesContext);
}

export default RoutinesContext;

/**
 * Loads (from the database) the routine behind a route's params and returns it
 * once available: { routine, loading, error, reload }.
 * Used by the step-by-step, free-mode and Routines screens.
 */
export function useLoadRoutine({ source, dateKey, generalRoutineId }) {
  const { loadRoutine, getRoutine } = useRoutines();
  const [status, setStatus] = useState({ loading: true, error: null });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setStatus({ loading: true, error: null });
    try {
      await loadRoutine({ source, dateKey, generalRoutineId });
      if (mounted.current) setStatus({ loading: false, error: null });
    } catch (err) {
      if (mounted.current) setStatus({ loading: false, error: errorMessage(err) });
    }
  }, [loadRoutine, source, dateKey, generalRoutineId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { routine: getRoutine({ source, dateKey, generalRoutineId }), ...status, reload };
}
