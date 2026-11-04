// src/screens/user/RoutinesScreen.js
//
// Routines Screen (User) - "Tu cronograma": today's training hero, the
// routine in use ("Cambiar rutina" -> "Elegí tu rutina") and the next trainings.
//
// Everything shown comes from the database (the day's routine / the general
// routine with its exercises are fetched when the screen opens). The hero
// follows the selected option (chosen on RoutinePickerScreen):
//   - My routines:       today's entry of the weekly schedule (incl. AI-made ones).
//   - General routines:  a default routine for today; if none was picked it is
//                        assigned at random, favouring ones not done yet.
//   - Don't follow:      no routine, only the free mode (camera only).
// "Ver ejercicios" opens "¿Cómo querés entrenar?" (step by step / read on your
// own). If "My routines" has nothing for today, a pop-up asks whether to build
// it by hand, generate it with AI or cancel.

import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, Modal, Alert, StyleSheet } from 'react-native';
import { ChevronRightIcon } from '../../components/common/PopupKit';
import globals from '../../styles/globals';
import BottomNav from '../../components/common/BottomNav';
import EmptyRoutinePopup from './popups/EmptyRoutinePopup';
import { useTranslation } from '../../i18n/I18nContext';
import { useRoutines, useLoadRoutine } from '../../context/RoutinesContext';
import { ROUTINE_OPTIONS, ROUTINE_SOURCES } from '../../constants/generalRoutines';
import { capitalize, getDateParts, getWeekDays, resolveRoutineTitle, toDateKey } from '../../utils/schedule';

/**
 * @param {function} [onBack]
 * @param {function} [onGoToHome] - "house" footer icon
 * @param {function} [onGoToProfile] - "person" footer icon
 * @param {function} [onGoToAchievementsGoals] - "trophy" footer icon
 * @param {function} [onGoToSchedule] - weekly schedule ("planificá tu semana")
 * @param {function} [onGoToRoutinePicker] - "Cambiar rutina" -> "Elegí tu rutina"
 * @param {function} [onGoToRoutineMode] - ({ source, dateKey, generalRoutineId }) => void, "¿Cómo querés entrenar?"
 * @param {function} [onGoToRoutineDay] - (dateKey) => void, opens a day's editor
 * @param {function} [onGoToFreeMode] - ({ source, dateKey, generalRoutineId }) => void (no routine: camera only)
 */
export default function RoutinesScreen({
  onBack,
  onGoToHome,
  onGoToProfile,
  onGoToAchievementsGoals,
  onGoToSchedule,
  onGoToRoutinePicker,
  onGoToRoutineMode,
  onGoToRoutineDay,
  onGoToFreeMode,
}) {
  const { t, language } = useTranslation();
  const { generateWithAi, routineOption, getGeneralChoice, assignRandomGeneralRoutine, generalRoutines, loadWeek, getDay } = useRoutines();

  // "Empty routine" pop-up (My routines with nothing planned for today).
  const [emptyPopup, setEmptyPopup] = useState(false);

  const today = new Date();
  const todayKey = toDateKey(today);
  const generalRoutineId = getGeneralChoice(todayKey);

  // Following default routines with none picked for today: assign one
  // (once the general routines have been loaded from the database).
  useEffect(() => {
    if (routineOption === ROUTINE_OPTIONS.GENERAL_ROUTINES && !generalRoutineId && generalRoutines.length > 0) {
      assignRandomGeneralRoutine(todayKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routineOption, generalRoutineId, todayKey, generalRoutines.length]);

  let source = ROUTINE_SOURCES.NONE;
  if (routineOption === ROUTINE_OPTIONS.MY_ROUTINES) source = ROUTINE_SOURCES.SCHEDULE;
  else if (routineOption === ROUTINE_OPTIONS.GENERAL_ROUTINES) source = ROUTINE_SOURCES.GENERAL;

  const routineParams = { source, dateKey: todayKey, generalRoutineId };
  // Fetches today's routine (with exercises) from the database.
  const { routine, loading: routineLoading } = useLoadRoutine(routineParams);
  const exerciseCount = routine?.exerciseCount ?? 0;

  // The next two planned days of the weekly schedule ("Próximo entrenamiento").
  const upcomingKeys = getWeekDays(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)).map(toDateKey);
  useEffect(() => {
    loadWeek(upcomingKeys).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayKey]);
  const upcoming = upcomingKeys
    .map((key) => ({ key, day: getDay(key) }))
    .filter(({ day }) => day && day.exerciseCount > 0)
    .slice(0, 2);

  const todayLabel = t('user.routines.todayDate', getDateParts(today, language));
  const heroTitle =
    source === ROUTINE_SOURCES.NONE
      ? t('user.routines.freeTrainingTitle')
      : routine
        ? resolveRoutineTitle(routine, t)
        : routineLoading
          ? '…'
          : t('user.routines.emptyRoutine');
  const heroMeta = exerciseCount > 0
    ? [
        t('user.home.durationMinutes', { count: routine.estimatedMinutes }),
        t('user.home.exercisesCount', { count: exerciseCount }),
      ]
    : [];

  // Which kind of routine is in use today (shown in the "Cambiar rutina" row).
  const currentKindLabel =
    routineOption === ROUTINE_OPTIONS.NO_ROUTINE
      ? t('user.routines.pickFree')
      : routineOption === ROUTINE_OPTIONS.GENERAL_ROUTINES
        ? t('user.routines.pickPremade')
        : routine?.source === 'AI'
          ? t('user.routines.pickAi')
          : t('user.routines.pickMine');

  // With a routine open "¿Cómo querés entrenar?"; without one (only possible
  // on "My routines") ask what to do. "Don't follow" has nothing to ask: free
  // mode is just the camera.
  const handleViewExercises = () => {
    if (source === ROUTINE_SOURCES.NONE) {
      if (onGoToFreeMode) onGoToFreeMode(routineParams);
      return;
    }
    if (routineLoading) return;
    if (exerciseCount > 0) {
      if (onGoToRoutineMode) onGoToRoutineMode(routineParams);
    } else {
      setEmptyPopup(true);
    }
  };

  const handleDoItMyself = () => {
    setEmptyPopup(false);
    if (onGoToRoutineDay) onGoToRoutineDay(todayKey);
  };

  // The backend analyses the person's history and saves today's routine.
  const handleGenerateWithAi = async () => {
    try {
      await generateWithAi([todayKey]);
    } catch {
      Alert.alert(t('user.routines.aiError'));
      return;
    }
    setEmptyPopup(false);
    if (onGoToRoutineMode) onGoToRoutineMode({ source: ROUTINE_SOURCES.SCHEDULE, dateKey: todayKey });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>{t('user.routines.scheduleTitle')}</Text>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
        <Text style={styles.todayLabel}>{t('user.routines.todayPrefix', { date: todayLabel })}</Text>
        <View style={styles.heroCard}>
          <Image source={require('../../assets/cronograma_hero.png')} style={styles.heroImage} />
          <View style={styles.heroTextCol}>
            <Text style={styles.heroKicker}>{t('user.routines.trainingLabel')}</Text>
            <Text style={styles.heroTitle} numberOfLines={3}>{heroTitle}</Text>
            {heroMeta.length > 0 && (
              <View style={styles.heroMetaRow}>
                {heroMeta.map((m, i) => (
                  <React.Fragment key={m}>
                    {i > 0 && <View style={styles.heroMetaDivider} />}
                    <Text style={styles.heroMeta}>{m}</Text>
                  </React.Fragment>
                ))}
              </View>
            )}
            <View style={styles.heroButtonsRow}>
              <TouchableOpacity style={styles.heroButton} onPress={handleViewExercises} activeOpacity={0.85}>
                <Text style={styles.heroButtonLabel}>
                  {source === ROUTINE_SOURCES.NONE ? t('user.routines.freeMode') : t('user.routines.viewExercises')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.kindRow} onPress={onGoToRoutinePicker} activeOpacity={0.8} accessibilityRole="button">
          <View style={styles.kindText}>
            <Text style={styles.kindLabel}>{t('user.routines.currentRoutine')}</Text>
            <Text style={styles.kindValue} numberOfLines={1}>{currentKindLabel}</Text>
          </View>
          <Text style={styles.kindAction}>{t('user.routines.changeRoutine')}</Text>
          <ChevronRightIcon size={16} />
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>{t('user.routines.nextTrainingLabel')}</Text>
        {upcoming.length > 0 ? (
          upcoming.map(({ key, day }) => {
            const parts = getDateParts(new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))), language);
            return (
              <TouchableOpacity
                key={key}
                style={styles.nextCard}
                onPress={() => onGoToRoutineDay && onGoToRoutineDay(key)}
                activeOpacity={0.8}
              >
                <View style={styles.nextText}>
                  <Text style={styles.nextDay}>{t('user.routines.dayTitle', { ...parts, weekday: capitalize(parts.weekday) })}</Text>
                  <Text style={styles.nextTitle} numberOfLines={1}>{resolveRoutineTitle(day, t)}</Text>
                  <Text style={styles.nextMeta}>
                    {`${t('user.home.durationMinutes', { count: day.estimatedMinutes })}  |  ${t('user.home.exercisesCount', { count: day.exerciseCount })}`}
                  </Text>
                </View>
                <ChevronRightIcon size={16} color={globals.colors.navInactive} />
              </TouchableOpacity>
            );
          })
        ) : (
          <TouchableOpacity style={[styles.nextCard, styles.nextEmpty]} onPress={onGoToSchedule} activeOpacity={0.8}>
            <View style={styles.nextText}>
              <Text style={styles.nextTitle}>{t('user.routines.nextEmptyTitle')}</Text>
              <Text style={styles.nextMeta}>{t('user.routines.nextEmptyBody')}</Text>
            </View>
            <ChevronRightIcon size={16} color={globals.colors.navInactive} />
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Shared footer: this IS the "calendar" destination, so that tab is
          passed as `active` instead of a handler. */}
      <BottomNav
        active="calendar"
        onGoToHome={onGoToHome}
        onGoToProfile={onGoToProfile}
        onGoToAchievements={onGoToAchievementsGoals}
      />

      <Modal transparent animationType="fade" visible={emptyPopup} onRequestClose={() => setEmptyPopup(false)}>
        <EmptyRoutinePopup
          onDoIt={handleDoItMyself}
          onGenerateWithAi={handleGenerateWithAi}
          onCancel={() => setEmptyPopup(false)}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: globals.colors.background },
  content: { flex: 1 },
  contentInner: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: globals.spacing.lg,
  },

  screenTitle: { fontSize: 28, fontWeight: '700', color: globals.colors.text, paddingHorizontal: 18, paddingTop: 28, paddingBottom: 6 },
  todayLabel: { fontSize: 14, fontWeight: '600', color: globals.colors.primary, marginTop: 14, marginBottom: 10 },

  // hero card (muscle image on the right, text + two buttons over it)
  heroCard: {
    backgroundColor: '#EEF2F3',
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 180,
    ...globals.shadow.card,
  },
  heroImage: { position: 'absolute', right: 0, top: 0, width: 150, height: '100%', resizeMode: 'cover' },
  heroTextCol: { flex: 1, padding: 16, justifyContent: 'center' },
  heroKicker: { fontSize: 12, fontWeight: '600', color: globals.colors.primary, marginBottom: 8 },
  heroTitle: { maxWidth: '60%', fontSize: 22, lineHeight: 27, fontWeight: '700', color: globals.colors.text, marginBottom: 10 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  heroMeta: { fontSize: 10, fontWeight: '600', color: globals.colors.textSecondary },
  heroMetaDivider: { width: 1, height: 10, marginHorizontal: 12, backgroundColor: '#CFCFCF' },
  heroButtonsRow: { flexDirection: 'row', marginTop: 'auto' },
  heroButton: {
    alignSelf: 'flex-start',
    backgroundColor: globals.colors.primary,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
    ...globals.shadow.button,
  },
  heroButtonLabel: { color: '#fff', fontWeight: '700', fontSize: 11 },

  // "Rutina de hoy: … Cambiar rutina ›"
  kindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: globals.colors.surface,
    borderWidth: 1,
    borderColor: globals.colors.surfaceBorder,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 12,
    ...globals.shadow.card,
  },
  kindText: { flex: 1 },
  kindLabel: { fontSize: 9, color: globals.colors.textSecondary },
  kindValue: { fontSize: 12, fontWeight: '800', color: globals.colors.text, marginTop: 1 },
  kindAction: { fontSize: 11, fontWeight: '700', color: globals.colors.primary, marginRight: 4 },

  // upcoming trainings
  sectionLabel: { fontSize: 10, fontWeight: '700', color: globals.colors.navInactive, marginTop: 22, marginBottom: 10, textTransform: 'uppercase' },
  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    backgroundColor: globals.colors.surface,
    borderWidth: 1,
    borderColor: globals.colors.surfaceBorder,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    ...globals.shadow.card,
  },
  nextEmpty: { borderStyle: 'dashed' },
  nextText: { flex: 1, paddingRight: 8 },
  nextDay: { fontSize: 9, fontWeight: '700', color: globals.colors.primary },
  nextTitle: { fontSize: 12, fontWeight: '800', color: globals.colors.text, marginTop: 2 },
  nextMeta: { fontSize: 9, color: globals.colors.textSecondary, marginTop: 3 },
});
