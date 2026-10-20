// src/screens/user/RoutinesScreen.js
//
// Routines Screen (User) - spec section 5.
//
// Connected to Backend/src/controllers/routine.controller.js via
// src/api/services/routine.api.js:
//   - GET  /routines/today                -> saved routines + free routine + AI suggestion
//   - GET  /routines/suggestions/patterns -> refresh the AI suggestion on demand
//   - POST /routines/suggestions/accept   -> "Recommended by the App" -> accept
//   - POST /routines/suggestions/reject   -> "Recommended by the App" -> dismiss
//   - POST /routines/requests             -> "request a routine from a trainer"
//
// "Pre-made" / "Custom" / "None" selection and the step-by-step vs
// read-on-your-own display mode are local UI state only — the Backend has
// no separate concept for them beyond which routine object is selected
// (routine.content is a free-form JSON blob either way, see
// Backend/src/validators/progress.schemas.js#createRoutineSchema).

import React, { useCallback, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import globals from '../../styles/globals';
import BottomNav from '../../components/common/BottomNav';
import { useTranslation } from '../../i18n/I18nContext';
import * as routineApi from '../../features/api/services/routine.api';

// Round selector on the right of an option card: empty ring when idle,
// filled teal circle with a check when selected (same as the onboarding
// "Elegir objetivo / nivel" steps in the mockups).
function Radio({ selected }) {
  return (
    <View style={[styles.radio, selected && styles.radioSelected]}>
      {selected && <Text style={styles.radioCheck}>✓</Text>}
    </View>
  );
}

/**
 * @param {function} [onBack]
 * @param {function} [onGoToHome] - "house" footer icon
 * @param {function} [onGoToProfile] - "person" footer icon
 * @param {function} [onGoToAchievementsGoals] - "trophy" footer icon
 */
export default function RoutinesScreen({ onBack, onGoToHome, onGoToProfile, onGoToAchievementsGoals }) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [hadError, setHadError] = useState(false);
  const [routines, setRoutines] = useState([]);
  const [freeRoutine, setFreeRoutine] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [suggestionBusy, setSuggestionBusy] = useState(false);
  const [suggestionMessage, setSuggestionMessage] = useState(null);

  const [selectedMode, setSelectedMode] = useState(null); // 'preMade' | 'custom' | 'recommended' | 'none'
  const [selectedRoutineId, setSelectedRoutineId] = useState(null);
  const [displayMode, setDisplayMode] = useState(null); // 'stepByStep' | 'readOnYourOwn'
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestMessage, setRequestMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await routineApi.getTodayOptions();
      const data = res?.data ?? {};
      setRoutines(data.routines ?? []);
      setFreeRoutine(data.freeRoutine ?? null);
      setSuggestion(data.suggestion ?? null);
      setHadError(false);
    } catch {
      setHadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const selectMode = (mode) => {
    setSelectedMode(mode);
    setSuggestionMessage(null);
    if (mode === 'preMade' && routines.length > 0) {
      setSelectedRoutineId(routines[0].id);
    } else if (mode === 'none') {
      setSelectedRoutineId(freeRoutine?.id ?? null);
    } else {
      setSelectedRoutineId(null);
    }
  };

  const handleAcceptSuggestion = async () => {
    setSuggestionBusy(true);
    setSuggestionMessage(null);
    try {
      await routineApi.acceptPatternSuggestion();
      setSuggestionMessage(t('user.routines.suggestionAccepted'));
      await load();
    } catch {
      setSuggestionMessage(t('user.routines.requestError'));
    } finally {
      setSuggestionBusy(false);
    }
  };

  const handleRejectSuggestion = async () => {
    setSuggestionBusy(true);
    setSuggestionMessage(null);
    try {
      await routineApi.rejectPatternSuggestion();
      setSuggestionMessage(t('user.routines.suggestionRejected'));
      setSuggestion(null);
    } catch {
      setSuggestionMessage(t('user.routines.requestError'));
    } finally {
      setSuggestionBusy(false);
    }
  };

  const handleRequestFromTrainer = async () => {
    setRequestBusy(true);
    setRequestMessage(null);
    try {
      await routineApi.requestRoutine();
      setRequestMessage(t('user.routines.requestSent'));
    } catch {
      setRequestMessage(t('user.routines.requestError'));
    } finally {
      setRequestBusy(false);
    }
  };

  // "Tu cronograma" hero: first saved routine (or the free routine) is
  // today's; the second saved one is the next training. Same data rule as
  // the Home screen (there's no weekly-schedule endpoint yet).
  const todayRoutine = routines[0] ?? freeRoutine ?? null;
  const nextRoutine = routines[1] ?? null;
  const exerciseCount = (r) => (Array.isArray(r?.content?.exercises) ? r.content.exercises.length : null);
  const duration = (r) => r?.content?.durationMinutes ?? null;
  const heroMeta = [
    duration(todayRoutine) != null ? t('user.home.durationMinutes', { count: duration(todayRoutine) }) : null,
    exerciseCount(todayRoutine) != null ? t('user.home.exercisesCount', { count: exerciseCount(todayRoutine) }) : null,
  ].filter(Boolean);
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + 1);
  const nextLabel = nextDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric' });

  // The hero button selects today's routine in the selector below.
  const pickToday = () => selectMode(routines.length > 0 ? 'preMade' : 'none');

  const routineOptions = [
    { key: 'preMade', label: t('user.routines.options.preMade') },
    { key: 'custom', label: t('user.routines.options.custom') },
    { key: 'recommended', label: t('user.routines.options.recommended') },
    { key: 'none', label: t('user.routines.options.none') },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>{t('user.routines.scheduleTitle')}</Text>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
        {hadError && <Text style={styles.errorText}>{t('user.routines.loadError')}</Text>}
        {loading ? (
          <ActivityIndicator color={globals.colors.primary} />
        ) : (
          <>
            {/* ---------------- TODAY ("Tu cronograma") ---------------- */}
            <Text style={styles.todayLabel}>{t('user.routines.todayPrefix', { date: todayLabel })}</Text>
            <View style={styles.heroCard}>
              <View style={styles.heroTextCol}>
                <Text style={styles.heroKicker}>{t('user.routines.trainingLabel')}</Text>
                <Text style={styles.heroTitle} numberOfLines={3}>
                  {todayRoutine?.name || (freeRoutine ? t('user.routines.freeRoutineName') : t('user.home.noRoutineTitle'))}
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
                <TouchableOpacity style={styles.heroButton} onPress={pickToday} disabled={!todayRoutine}>
                  <Text style={styles.heroButtonLabel}>{t('user.routines.viewRoutine')}</Text>
                  <Text style={styles.heroButtonArrow}>›</Text>
                </TouchableOpacity>
              </View>
              <Image source={require('../../assets/cronograma_hero.png')} style={styles.heroImage} />
            </View>

            {nextRoutine && (
              <>
                <Text style={styles.sectionLabel}>{t('user.home.nextTrainingLabel')}</Text>
                <View style={styles.nextCard}>
                  <View style={styles.nextIcon}>
                    <Image source={require('../../assets/Imagen.png')} style={styles.nextIconImg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nextDay}>{nextLabel}</Text>
                    <Text style={styles.nextTitle} numberOfLines={1}>{nextRoutine.name}</Text>
                    {exerciseCount(nextRoutine) != null && (
                      <Text style={styles.nextMeta}>{t('user.home.exercisesCount', { count: exerciseCount(nextRoutine) })}</Text>
                    )}
                  </View>
                </View>
              </>
            )}

            <Text style={styles.chooseTitle}>{t('user.routines.chooseTitle')}</Text>
            {routineOptions.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.optionRow, selectedMode === opt.key && styles.optionRowSelected]}
                onPress={() => selectMode(opt.key)}
              >
                <Text style={styles.optionText}>{opt.label}</Text>
                <Radio selected={selectedMode === opt.key} />
              </TouchableOpacity>
            ))}

            {selectedMode === 'preMade' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('user.routines.savedTitle')}</Text>
                {routines.length === 0 ? (
                  <Text style={styles.emptyText}>{t('user.routines.savedEmpty')}</Text>
                ) : (
                  routines.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.row, selectedRoutineId === r.id && styles.rowSelected]}
                      onPress={() => setSelectedRoutineId(r.id)}
                    >
                      <Text style={styles.rowPrimary}>{r.name}</Text>
                      <Radio selected={selectedRoutineId === r.id} />
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {selectedMode === 'none' && freeRoutine && (
              <View style={styles.section}>
                <View style={[styles.row, styles.rowSelected]}>
                  <Text style={styles.rowPrimary}>{t('user.routines.freeRoutineName')}</Text>
                  <Radio selected />
                </View>
              </View>
            )}

            {selectedMode === 'recommended' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('user.routines.suggestionTitle')}</Text>
                {suggestion ? (
                  <View style={styles.row}>
                    <Text style={styles.rowPrimary}>{suggestion.name}</Text>
                    <Text style={styles.rowSecondary}>{suggestion.content?.basedOn?.type}</Text>
                    <View style={styles.suggestionActions}>
                      <TouchableOpacity
                        style={styles.smallButton}
                        onPress={handleAcceptSuggestion}
                        disabled={suggestionBusy}
                      >
                        <Text style={styles.smallButtonText}>{t('user.routines.suggestionAccept')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.smallButtonOutline}
                        onPress={handleRejectSuggestion}
                        disabled={suggestionBusy}
                      >
                        <Text style={styles.smallButtonOutlineText}>{t('user.routines.suggestionReject')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.emptyText}>{t('user.routines.suggestionUnavailable')}</Text>
                )}
                {suggestionMessage && <Text style={styles.infoText}>{suggestionMessage}</Text>}
              </View>
            )}

            <Text style={styles.sectionTitle}>{t('user.routines.displayMode')}</Text>
            <TouchableOpacity
              style={[styles.optionRow, displayMode === 'stepByStep' && styles.optionRowSelected, !selectedRoutineId && styles.optionRowDisabled]}
              onPress={() => setDisplayMode('stepByStep')}
              disabled={!selectedRoutineId}
            >
              <Text style={styles.optionText}>{t('user.routines.stepByStepGuide')}</Text>
              <Radio selected={displayMode === 'stepByStep'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.optionRow, displayMode === 'readOnYourOwn' && styles.optionRowSelected, !selectedRoutineId && styles.optionRowDisabled]}
              onPress={() => setDisplayMode('readOnYourOwn')}
              disabled={!selectedRoutineId}
            >
              <Text style={styles.optionText}>{t('user.routines.readOnYourOwn')}</Text>
              <Radio selected={displayMode === 'readOnYourOwn'} />
            </TouchableOpacity>
            {!selectedRoutineId && (
              <Text style={styles.emptyText}>{t('user.routines.selectRoutineFirst')}</Text>
            )}

            <TouchableOpacity
              style={styles.requestButton}
              onPress={handleRequestFromTrainer}
              disabled={requestBusy}
            >
              <Text style={styles.requestButtonText}>{t('user.routines.requestFromTrainer')}</Text>
            </TouchableOpacity>
            {requestMessage && <Text style={styles.infoText}>{requestMessage}</Text>}
          </>
        )}

      </ScrollView>

      {/* ---------------- FOOTER ----------------
          Shared component: same 5 buttons -> same 5 destinations on every
          screen that has it. This IS the "calendar" destination, so that
          tab is passed as `active` instead of a handler. */}
      <BottomNav
        active="calendar"
        onGoToHome={onGoToHome}
        onGoToProfile={onGoToProfile}
        onGoToAchievements={onGoToAchievementsGoals}
      />
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
  section: { marginBottom: globals.spacing.md },

  // ---- "Tu cronograma" top ----
  screenTitle: { fontSize: 28, fontWeight: '700', color: globals.colors.text, paddingHorizontal: 18, paddingTop: 28, paddingBottom: 6 },
  todayLabel: { fontSize: 14, fontWeight: '600', color: globals.colors.primary, marginTop: 14, marginBottom: 10, textTransform: 'capitalize' },
  heroCard: {
    flexDirection: 'row',
    backgroundColor: '#EEF2F3',
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 180,
    ...globals.shadow.card,
  },
  heroTextCol: { flex: 1, padding: 16, justifyContent: 'center', zIndex: 1 },
  heroKicker: { fontSize: 12, fontWeight: '600', color: globals.colors.primary, marginBottom: 8 },
  heroTitle: { fontSize: 22, lineHeight: 27, fontWeight: '700', color: globals.colors.text, marginBottom: 10 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  heroMeta: { fontSize: 10, fontWeight: '600', color: globals.colors.textSecondary },
  heroMetaDivider: { width: 1, height: 10, marginHorizontal: 12, backgroundColor: '#CFCFCF' },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: globals.colors.primary,
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 16,
    ...globals.shadow.button,
  },
  heroButtonLabel: { color: '#fff', fontWeight: '600', fontSize: 12 },
  heroButtonArrow: { color: '#fff', fontSize: 18, lineHeight: 18 },
  heroImage: { width: 130, height: '100%', resizeMode: 'cover', marginLeft: -10 },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: globals.colors.navInactive, marginTop: 22, marginBottom: 10, textTransform: 'uppercase' },
  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: globals.colors.surface,
    borderWidth: 1,
    borderColor: globals.colors.surfaceBorder,
    borderRadius: 10,
    padding: 12,
    ...globals.shadow.card,
  },
  nextIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: globals.colors.tealSoft, alignItems: 'center', justifyContent: 'center' },
  nextIconImg: { width: 22, height: 22, resizeMode: 'contain', tintColor: globals.colors.primary },
  nextDay: { fontSize: 10, color: globals.colors.textSecondary, textTransform: 'capitalize' },
  nextTitle: { fontSize: 16, fontWeight: '700', color: globals.colors.text },
  nextMeta: { fontSize: 9, color: globals.colors.textSecondary, marginTop: 2 },
  chooseTitle: { fontSize: 16, fontWeight: '700', color: globals.colors.text, marginTop: 28, marginBottom: 12 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: globals.colors.text,
    marginTop: globals.spacing.md,
    marginBottom: 10,
  },

  // option cards: white, soft shadow, radio on the right
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: globals.colors.surface,
    borderWidth: 1,
    borderColor: globals.colors.surfaceBorder,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 12,
    ...globals.shadow.card,
  },
  optionRowSelected: {
    borderColor: globals.colors.primary,
  },
  optionRowDisabled: {
    opacity: 0.5,
  },
  optionText: { flex: 1, fontSize: 15, fontWeight: '500', color: globals.colors.text },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#CFCFCF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  radioSelected: {
    backgroundColor: globals.colors.primary,
    borderColor: globals.colors.primary,
  },
  radioCheck: { color: '#fff', fontSize: 12, fontWeight: '700', lineHeight: 14 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: globals.colors.surface,
    borderWidth: 1,
    borderColor: globals.colors.surfaceBorder,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    ...globals.shadow.card,
  },
  rowSelected: { borderColor: globals.colors.primary },
  rowPrimary: { flex: 1, fontSize: 14, color: globals.colors.text, fontWeight: '600' },
  rowSecondary: { fontSize: 11, color: globals.colors.textSecondary, marginTop: globals.spacing.xs },
  emptyText: { fontSize: 12, color: globals.colors.textSecondary, marginTop: 4 },
  errorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    marginBottom: globals.spacing.md,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 12,
    color: globals.colors.primary,
    marginTop: globals.spacing.xs,
  },
  suggestionActions: { flexDirection: 'row', marginTop: globals.spacing.sm },
  smallButton: {
    backgroundColor: globals.colors.primary,
    borderRadius: 8,
    paddingVertical: globals.spacing.sm,
    paddingHorizontal: globals.spacing.md,
    marginRight: globals.spacing.sm,
  },
  smallButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  smallButtonOutline: {
    borderWidth: 1,
    borderColor: globals.colors.surfaceBorder,
    borderRadius: 8,
    paddingVertical: globals.spacing.sm,
    paddingHorizontal: globals.spacing.md,
  },
  smallButtonOutlineText: { color: globals.colors.text, fontSize: 12 },

  // primary action, same look as "Siguiente" in the onboarding mockups
  requestButton: {
    backgroundColor: globals.colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    marginTop: globals.spacing.lg,
    alignItems: 'center',
    ...globals.shadow.button,
  },
  requestButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
