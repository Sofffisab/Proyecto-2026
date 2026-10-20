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
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import globals from '../../styles/globals';
import Header from '../../components/common/Header';
import BottomNav from '../../components/common/BottomNav';
import { useTranslation } from '../../i18n/I18nContext';
import * as routineApi from '../../api/services/routine.api';

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

  const routineOptions = [
    { key: 'preMade', label: t('user.routines.options.preMade') },
    { key: 'custom', label: t('user.routines.options.custom') },
    { key: 'recommended', label: t('user.routines.options.recommended') },
    { key: 'none', label: t('user.routines.options.none') },
  ];

  return (
    <View style={styles.container}>
      <Header pageTitle={t('user.routines.title')} />
      <ScrollView style={styles.content}>
        {hadError && <Text style={styles.errorText}>{t('user.routines.loadError')}</Text>}
        {loading ? (
          <ActivityIndicator color={globals.colors.primary} />
        ) : (
          <>
            {routineOptions.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.optionRow, selectedMode === opt.key && styles.optionRowSelected]}
                onPress={() => selectMode(opt.key)}
              >
                <Text style={styles.optionText}>{opt.label}</Text>
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
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {selectedMode === 'none' && freeRoutine && (
              <View style={styles.section}>
                <View style={[styles.row, styles.rowSelected]}>
                  <Text style={styles.rowPrimary}>{t('user.routines.freeRoutineName')}</Text>
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
              style={[styles.optionRow, displayMode === 'stepByStep' && styles.optionRowSelected]}
              onPress={() => setDisplayMode('stepByStep')}
              disabled={!selectedRoutineId}
            >
              <Text style={styles.optionText}>{t('user.routines.stepByStepGuide')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.optionRow, displayMode === 'readOnYourOwn' && styles.optionRowSelected]}
              onPress={() => setDisplayMode('readOnYourOwn')}
              disabled={!selectedRoutineId}
            >
              <Text style={styles.optionText}>{t('user.routines.readOnYourOwn')}</Text>
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

        <Text style={styles.backLink} onPress={onBack}>{t('user.routines.back')}</Text>
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
  content: { flex: 1, padding: globals.spacing.md },
  section: { marginBottom: globals.spacing.lg },
  sectionTitle: {
    fontSize: globals.fontSize.md,
    fontWeight: '600',
    color: globals.colors.text,
    marginTop: globals.spacing.md,
    marginBottom: globals.spacing.sm,
  },
  optionRow: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    padding: globals.spacing.md,
    marginBottom: globals.spacing.sm,
  },
  optionRowSelected: {
    borderColor: globals.colors.primary,
    backgroundColor: globals.colors.sectionCard,
  },
  optionText: { fontSize: globals.fontSize.md, color: globals.colors.text },
  row: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    padding: globals.spacing.md,
    marginBottom: globals.spacing.sm,
  },
  rowSelected: { borderColor: globals.colors.primary },
  rowPrimary: { fontSize: globals.fontSize.md, color: globals.colors.text, fontWeight: '600' },
  rowSecondary: { fontSize: globals.fontSize.sm, color: globals.colors.textMuted, marginTop: globals.spacing.xs },
  emptyText: { fontSize: globals.fontSize.sm, color: globals.colors.textMuted },
  errorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    marginBottom: globals.spacing.md,
    textAlign: 'center',
  },
  infoText: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.primary,
    marginTop: globals.spacing.xs,
  },
  suggestionActions: { flexDirection: 'row', marginTop: globals.spacing.sm },
  smallButton: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.sm,
    paddingHorizontal: globals.spacing.md,
    marginRight: globals.spacing.sm,
  },
  smallButtonText: { color: globals.colors.background, fontSize: globals.fontSize.sm, fontWeight: '600' },
  smallButtonOutline: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.sm,
    paddingHorizontal: globals.spacing.md,
  },
  smallButtonOutlineText: { color: globals.colors.text, fontSize: globals.fontSize.sm },
  requestButton: {
    borderWidth: 1,
    borderColor: globals.colors.primary,
    borderRadius: globals.radius.md,
    padding: globals.spacing.md,
    marginTop: globals.spacing.lg,
    alignItems: 'center',
  },
  requestButtonText: { color: globals.colors.primary, fontSize: globals.fontSize.md, fontWeight: '600' },
  backLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginVertical: globals.spacing.lg,
  },
});
