// src/screens/user/RoutinesScreen.js
//
// Routines Screen (User) - "Tu cronograma" hero + option list.
//
// Frontend only: the routine shown in the hero is today's entry of the weekly
// schedule kept in RoutinesContext (edited from the schedule / day screens).
//   - Tapping the "My routines" row selects it (the hero shows today's routine).
//   - Tapping its arrow opens the schedule screen.
//   - "Paso a paso" / "Seguir libre" open today's routine; if today is empty a
//     pop-up asks whether to build it by hand, generate it with AI or cancel.
// "General routines" and "Don't follow a routine" are static for now.

import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import BottomNav from '../../components/common/BottomNav';
import EmptyRoutinePopup from './popups/EmptyRoutinePopup';
import { useTranslation } from '../../i18n/I18nContext';
import { useRoutines } from '../../context/RoutinesContext';
import { estimateMinutes, getDateParts, toDateKey } from '../../utils/schedule';

const OPTIONS = {
  MY_ROUTINES: 'myRoutines',
  GENERAL_ROUTINES: 'generalRoutines',
  NO_ROUTINE: 'noRoutine',
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
 * @param {function} [onGoToRoutineDay] - (dateKey) => void, opens a day's routine
 */
export default function RoutinesScreen({ onBack, onGoToHome, onGoToProfile, onGoToAchievementsGoals, onGoToSchedule, onGoToRoutineDay }) {
  const { t, language } = useTranslation();
  const { getDay, generateWithAi } = useRoutines();

  const [selectedOption, setSelectedOption] = useState(OPTIONS.MY_ROUTINES);
  const [showEmptyPopup, setShowEmptyPopup] = useState(false);

  const today = new Date();
  const todayKey = toDateKey(today);
  const todayEntry = getDay(todayKey);
  const showRoutine = selectedOption === OPTIONS.MY_ROUTINES && todayEntry != null;
  const exercises = todayEntry?.exercises ?? [];

  const todayLabel = t('user.routines.todayDate', getDateParts(today, language));
  const heroMeta = showRoutine && exercises.length > 0
    ? [
        t('user.home.durationMinutes', { count: estimateMinutes(exercises) }),
        t('user.home.exercisesCount', { count: exercises.length }),
      ]
    : [];

  const routineOptions = [
    { key: OPTIONS.MY_ROUTINES, label: t('user.routines.options.myRoutines') },
    { key: OPTIONS.GENERAL_ROUTINES, label: t('user.routines.options.generalRoutines') },
    { key: OPTIONS.NO_ROUTINE, label: t('user.routines.options.noRoutine') },
  ];

  // "Paso a paso" / "Seguir libre": open today's routine, or ask what to do
  // when there isn't one yet.
  const handleStart = () => {
    if (exercises.length > 0) {
      if (onGoToRoutineDay) onGoToRoutineDay(todayKey);
    } else {
      setShowEmptyPopup(true);
    }
  };

  const handleDoItMyself = () => {
    setShowEmptyPopup(false);
    if (onGoToRoutineDay) onGoToRoutineDay(todayKey);
  };

  const handleGenerateWithAi = () => {
    generateWithAi([todayKey], t('user.routines.aiRoutineTitle'));
    setShowEmptyPopup(false);
    if (onGoToRoutineDay) onGoToRoutineDay(todayKey);
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
            <Text style={styles.heroTitle} numberOfLines={3}>
              {showRoutine ? todayEntry.title || t('user.routines.defaultDayTitle') : t('user.routines.emptyRoutine')}
            </Text>
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
              <TouchableOpacity style={styles.heroButton} onPress={handleStart}>
                <Text style={styles.heroButtonLabel}>{t('user.routines.stepByStep')}</Text>
                <Text style={styles.heroButtonArrow}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.heroButton} onPress={handleStart}>
                <Text style={styles.heroButtonLabel}>{t('user.routines.freeMode')}</Text>
                <Text style={styles.heroButtonArrow}>›</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>{t('user.routines.nextTrainingLabel')}</Text>
        {routineOptions.map((opt) => {
          const selected = selectedOption === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.optionRow, selected && styles.optionRowSelected]}
              onPress={() => setSelectedOption(opt.key)}
              activeOpacity={0.8}
            >
              <Checkbox selected={selected} />
              <Text style={styles.optionText}>{opt.label}</Text>
              {opt.key === OPTIONS.MY_ROUTINES && (
                <TouchableOpacity style={styles.optionArrowButton} onPress={onGoToSchedule} hitSlop={10}>
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

      <Modal transparent animationType="fade" visible={showEmptyPopup} onRequestClose={() => setShowEmptyPopup(false)}>
        <EmptyRoutinePopup
          onDoIt={handleDoItMyself}
          onGenerateWithAi={handleGenerateWithAi}
          onCancel={() => setShowEmptyPopup(false)}
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
