// src/screens/user/RoutinesScreen.js
//
// Routines Screen (User) - "Tu cronograma" hero + option list.
//
// Frontend only. The hero follows the selected option:
//   - My routines:       today's entry of the weekly schedule (arrow -> schedule).
//   - General routines:  a default routine for today; if none was picked it is
//                        assigned at random, favouring ones not done yet
//                        (arrow -> list of default routines to pick from).
//   - Don't follow:      no routine, only "Free mode" (camera only).
// "Paso a paso" opens the step-by-step screen and "Seguir libre" the static
// free-mode screen. If "My routines" has nothing for today, a pop-up asks
// whether to build it by hand, generate it with AI or cancel.

import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import BottomNav from '../../components/common/BottomNav';
import EmptyRoutinePopup from './popups/EmptyRoutinePopup';
import { useTranslation } from '../../i18n/I18nContext';
import { useRoutines } from '../../context/RoutinesContext';
import { GENERAL_ROUTINES, ROUTINE_OPTIONS, ROUTINE_SOURCES } from '../../constants/generalRoutines';
import { estimateMinutes, getDateParts, resolveRoutineTitle, toDateKey } from '../../utils/schedule';

const START_MODES = {
  STEP_BY_STEP: 'stepByStep',
  FREE: 'free',
};

// Square checkbox on the left of an option row: empty when idle, filled teal
// with a check when selected.
function Checkbox({ selected }) {
  return (
    <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
      {selected && <Text style={styles.checkboxCheck}>✓</Text>}
    </View>
  );
}

/**
 * @param {function} [onBack]
 * @param {function} [onGoToHome] - "house" footer icon
 * @param {function} [onGoToProfile] - "person" footer icon
 * @param {function} [onGoToAchievementsGoals] - "trophy" footer icon
 * @param {function} [onGoToSchedule] - arrow of the "My routines" row
 * @param {function} [onGoToGeneralRoutines] - arrow of the "General routines" row
 * @param {function} [onGoToRoutineDay] - (dateKey) => void, opens a day's editor
 * @param {function} [onGoToStepByStep] - ({ source, dateKey, generalRoutineId }) => void
 * @param {function} [onGoToFreeMode] - ({ source, dateKey, generalRoutineId }) => void
 */
export default function RoutinesScreen({
  onBack,
  onGoToHome,
  onGoToProfile,
  onGoToAchievementsGoals,
  onGoToSchedule,
  onGoToGeneralRoutines,
  onGoToRoutineDay,
  onGoToStepByStep,
  onGoToFreeMode,
}) {
  const { t, language } = useTranslation();
  const { getDay, generateWithAi, routineOption, setRoutineOption, getGeneralChoice, assignRandomGeneralRoutine } = useRoutines();

  // Start mode waiting on the "empty routine" pop-up (null = pop-up closed).
  const [pendingMode, setPendingMode] = useState(null);

  const today = new Date();
  const todayKey = toDateKey(today);
  const generalRoutineId = getGeneralChoice(todayKey);

  // Following default routines with none picked for today: assign one.
  useEffect(() => {
    if (routineOption === ROUTINE_OPTIONS.GENERAL_ROUTINES && !generalRoutineId) {
      assignRandomGeneralRoutine(todayKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routineOption, generalRoutineId, todayKey]);

  let source = ROUTINE_SOURCES.NONE;
  let routine = null;
  if (routineOption === ROUTINE_OPTIONS.MY_ROUTINES) {
    source = ROUTINE_SOURCES.SCHEDULE;
    routine = getDay(todayKey);
  } else if (routineOption === ROUTINE_OPTIONS.GENERAL_ROUTINES) {
    source = ROUTINE_SOURCES.GENERAL;
    routine = GENERAL_ROUTINES.find((r) => r.id === generalRoutineId) ?? null;
  }
  const exercises = routine?.exercises ?? [];
  const routineParams = { source, dateKey: todayKey, generalRoutineId };

  const todayLabel = t('user.routines.todayDate', getDateParts(today, language));
  const heroTitle =
    source === ROUTINE_SOURCES.NONE
      ? t('user.routines.freeTrainingTitle')
      : routine
        ? resolveRoutineTitle(routine, t)
        : t('user.routines.emptyRoutine');
  const heroMeta = exercises.length > 0
    ? [
        t('user.home.durationMinutes', { count: estimateMinutes(exercises) }),
        t('user.home.exercisesCount', { count: exercises.length }),
      ]
    : [];

  const routineOptions = [
    { key: ROUTINE_OPTIONS.MY_ROUTINES, label: t('user.routines.options.myRoutines'), hasArrow: true, onArrow: onGoToSchedule },
    { key: ROUTINE_OPTIONS.GENERAL_ROUTINES, label: t('user.routines.options.generalRoutines'), hasArrow: true, onArrow: onGoToGeneralRoutines },
    { key: ROUTINE_OPTIONS.NO_ROUTINE, label: t('user.routines.options.noRoutine') },
  ];

  const goToMode = (mode, params) => {
    const handler = mode === START_MODES.STEP_BY_STEP ? onGoToStepByStep : onGoToFreeMode;
    if (handler) handler(params);
  };

  // With a routine open the mode screen; without one (only possible on "My
  // routines") ask what to do. "Don't follow" has nothing to ask: free mode
  // is just the camera.
  const handleStart = (mode) => {
    if (source === ROUTINE_SOURCES.NONE || exercises.length > 0) {
      goToMode(mode, routineParams);
    } else {
      setPendingMode(mode);
    }
  };

  const handleDoItMyself = () => {
    setPendingMode(null);
    if (onGoToRoutineDay) onGoToRoutineDay(todayKey);
  };

  const handleGenerateWithAi = () => {
    const mode = pendingMode;
    generateWithAi([todayKey], t('user.routines.aiRoutineTitle'));
    setPendingMode(null);
    goToMode(mode, { source: ROUTINE_SOURCES.SCHEDULE, dateKey: todayKey });
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
              {source !== ROUTINE_SOURCES.NONE && (
                <TouchableOpacity style={styles.heroButton} onPress={() => handleStart(START_MODES.STEP_BY_STEP)}>
                  <Text style={styles.heroButtonLabel}>{t('user.routines.stepByStep')}</Text>
                  <Text style={styles.heroButtonArrow}>›</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.heroButton} onPress={() => handleStart(START_MODES.FREE)}>
                <Text style={styles.heroButtonLabel}>{t('user.routines.freeMode')}</Text>
                <Text style={styles.heroButtonArrow}>›</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>{t('user.routines.nextTrainingLabel')}</Text>
        {routineOptions.map((opt) => {
          const selected = routineOption === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.optionRow, selected && styles.optionRowSelected]}
              onPress={() => setRoutineOption(opt.key)}
              activeOpacity={0.8}
            >
              <Checkbox selected={selected} />
              <Text style={styles.optionText}>{opt.label}</Text>
              {opt.hasArrow && (
                <TouchableOpacity style={styles.optionArrowButton} onPress={opt.onArrow} hitSlop={10}>
                  <Image source={require('../../assets/derecha.png')} style={styles.optionArrow} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Shared footer: this IS the "calendar" destination, so that tab is
          passed as `active` instead of a handler. */}
      <BottomNav
        active="calendar"
        onGoToHome={onGoToHome}
        onGoToProfile={onGoToProfile}
        onGoToAchievements={onGoToAchievementsGoals}
      />

      <Modal transparent animationType="fade" visible={pendingMode != null} onRequestClose={() => setPendingMode(null)}>
        <EmptyRoutinePopup
          onDoIt={handleDoItMyself}
          onGenerateWithAi={handleGenerateWithAi}
          onCancel={() => setPendingMode(null)}
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
  heroButtonsRow: { flexDirection: 'row', gap: 8, marginTop: 'auto' },
  heroButton: {
    flex: 1,
    maxWidth: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: globals.colors.primary,
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    ...globals.shadow.button,
  },
  heroButtonLabel: { color: '#fff', fontWeight: '600', fontSize: 12 },
  heroButtonArrow: { color: '#fff', fontSize: 18, lineHeight: 18 },

  // option rows: light grey, darker when selected, checkbox left + arrow right
  sectionLabel: { fontSize: 11, fontWeight: '600', color: globals.colors.navInactive, marginTop: 22, marginBottom: 10, textTransform: 'uppercase' },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    backgroundColor: '#EEF2F3',
    borderRadius: 8,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  optionRowSelected: { backgroundColor: '#D9D9D9' },
  optionText: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    color: globals.colors.text,
  },
  optionArrowButton: { marginLeft: 'auto' },
  optionArrow: { width: 18, height: 18, resizeMode: 'contain' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CFCFCF',
    backgroundColor: globals.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: globals.colors.primary,
    borderColor: globals.colors.primary,
  },
  checkboxCheck: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 16 },
});
