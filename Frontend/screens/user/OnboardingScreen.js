import React from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Minimal Profile Personalization (User) - spec sections 4, 5, 6 y 7.
 * Four separate screens, each with a single selector and its own Back
 * button, only shown the first time the user role logs in. They only
 * appear again on subsequent logins if the profile is still incomplete.
 *
 * Visual spec: step indicator ("1/4" + progress bar), title, helper
 * subtitle, a stacked list of selectable option cards (selected card gets
 * a filled check), and a full-width primary button at the bottom.
 * There is intentionally no "Skip" action here: unlike the reference
 * mockup, these fields are required to finish creating the profile
 * (see profileCompletion.middleware.js), so skipping isn't offered.
 *
 * Selections map exactly to the Backend enums (see
 * Backend/prisma/schema.prisma and Backend/src/validators/user.schemas.js):
 *   - mainGoal        -> objectives: MainGoal[]        (single-select, one value)
 *   - currentLevel    -> trainingLevel: ExperienceLevel (single-select)
 *   - daysPerWeek     -> weeklyTrainingDays: TrainingFrequency (single-select)
 *   - trainingType    -> trainingType: TrainingType     (single-select)
 */
const TOTAL_STEPS = 4;
const GOAL_KEYS = ['LOSE_WEIGHT', 'GAIN_MUSCLE', 'IMPROVE_HEALTH', 'INCREASE_ENDURANCE'];
const LEVEL_KEYS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const DAYS_KEYS = ['ONE_TO_TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN'];
const TRAINING_TYPE_KEYS = ['STRENGTH', 'CARDIO', 'FUNCTIONAL', 'MIXED'];

/** Step indicator: back chevron + "N/4" + optional logout + segmented progress bar. */
function StepHeader({ step, onBack, onLogout, loading }) {
  const { t } = useTranslation();
  return (
    <View>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} disabled={loading} hitSlop={12} style={styles.backButton}>
          <Image
            source={require('../../assets/basil_caret-left-outline.png')}
            style={styles.backIcon}
          />
        </TouchableOpacity>
        <Text style={styles.stepText}>{step}/{TOTAL_STEPS}</Text>
        {onLogout ? (
          <TouchableOpacity onPress={onLogout} disabled={loading} hitSlop={12} style={styles.logoutButton}>
            <Text style={styles.logoutText}>{t('user.onboarding.logout')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backButton} />
        )}
      </View>

      <View style={styles.progressTrack}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressSegment,
              i < step ? styles.progressSegmentDone : styles.progressSegmentPending,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

/** Shared single-select step screen (pantalla 4/5/6/7). */
function OnboardingStepScreen({ step, titleKey, subtitleKey, i18nGroup, optionKeys, value, onSelect, onContinue, onBack, onLogout, loading, error }) {
  const { t } = useTranslation();
  const options = optionKeys.map((key) => ({ key, label: t(`user.onboarding.${i18nGroup}.${key}`) }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <StepHeader step={step} onBack={onBack} onLogout={onLogout} loading={loading} />

      <View style={styles.titleBlock}>
        <Text style={styles.title}>{t(titleKey)}</Text>
        <Text style={styles.subtitle}>{t(subtitleKey)}</Text>
      </View>

      <View style={styles.group}>
        {options.map(({ key, label }) => {
          const isSelected = value === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.option, isSelected && styles.optionSelected]}
              onPress={() => onSelect(key)}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                {label}
              </Text>
              {isSelected && (
                <View style={styles.checkCircle}>
                  <Text style={styles.checkMark}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity
        style={[styles.continueButton, (loading || !value) && styles.buttonDisabled]}
        onPress={onContinue}
        disabled={loading || !value}
      >
        {loading ? (
          <ActivityIndicator color={globals.colors.background} />
        ) : (
          <Text style={styles.continueButtonText}>{t('user.onboarding.continue')}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

/** Pantalla 1/4: Selector de Objetivo principal (4 opciones). */
export function OnboardingGoalScreen({ value, onSelect, onContinue, onBack, onLogout, loading, error }) {
  return (
    <OnboardingStepScreen
      step={1}
      titleKey="user.onboarding.mainGoal"
      subtitleKey="user.onboarding.helper"
      i18nGroup="goals"
      optionKeys={GOAL_KEYS}
      value={value}
      onSelect={onSelect}
      onContinue={onContinue}
      onBack={onBack}
      onLogout={onLogout}
      loading={loading}
      error={error}
    />
  );
}

/** Pantalla 2/4: Selector de Nivel actual (3 opciones). */
export function OnboardingLevelScreen({ value, onSelect, onContinue, onBack, onLogout, loading, error }) {
  return (
    <OnboardingStepScreen
      step={2}
      titleKey="user.onboarding.currentLevel"
      subtitleKey="user.onboarding.helper"
      i18nGroup="levels"
      optionKeys={LEVEL_KEYS}
      value={value}
      onSelect={onSelect}
      onContinue={onContinue}
      onBack={onBack}
      onLogout={onLogout}
      loading={loading}
      error={error}
    />
  );
}

/** Pantalla 3/4: Selector de días de entrenamiento por semana (6 opciones). */
export function OnboardingDaysScreen({ value, onSelect, onContinue, onBack, onLogout, loading, error }) {
  return (
    <OnboardingStepScreen
      step={3}
      titleKey="user.onboarding.daysPerWeek"
      subtitleKey="user.onboarding.helper"
      i18nGroup="days"
      optionKeys={DAYS_KEYS}
      value={value}
      onSelect={onSelect}
      onContinue={onContinue}
      onBack={onBack}
      onLogout={onLogout}
      loading={loading}
      error={error}
    />
  );
}

/** Pantalla 4/4: Selector de tipo de entrenamiento buscado (4 opciones). */
export function OnboardingTypeScreen({ value, onSelect, onContinue, onBack, onLogout, loading, error }) {
  return (
    <OnboardingStepScreen
      step={4}
      titleKey="user.onboarding.trainingType"
      subtitleKey="user.onboarding.helper"
      i18nGroup="trainingTypes"
      optionKeys={TRAINING_TYPE_KEYS}
      value={value}
      onSelect={onSelect}
      onContinue={onContinue}
      onBack={onBack}
      onLogout={onLogout}
      loading={loading}
      error={error}
    />
  );
}

/**
 * Confirmation screen shown right after the last onboarding form (pantalla
 * de tipo de entrenamiento) is saved successfully. It's a dead end with a
 * single CTA ("Ir a mi plan") that continues the existing flow, redirecting
 * to Settings so the person can finish the remaining required fields
 * (birthday, medical conditions, delivery address).
 */
export function OnboardingSuccessScreen({ onContinue }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.container, styles.successContainer]}>
      <View style={styles.successIconOuter}>
        <View style={styles.successIconInner}>
          <Text style={styles.successCheck}>✓</Text>
        </View>
      </View>

      <Text style={styles.successTitle}>{t('user.onboarding.success.title')}</Text>
      <Text style={styles.successSubtitle}>{t('user.onboarding.success.subtitle')}</Text>

      <TouchableOpacity style={[styles.continueButton, styles.successButton]} onPress={onContinue}>
        <Text style={styles.continueButtonText}>{t('user.onboarding.success.cta')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: globals.colors.background,
  },
  content: {
    flexGrow: 1,
    padding: globals.spacing.md,
    paddingBottom: globals.spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
  },
  backIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  stepText: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    fontWeight: '600',
  },
  logoutButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  logoutText: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.danger,
    fontWeight: '600',
  },
  progressTrack: {
    flexDirection: 'row',
    gap: globals.spacing.xs,
    marginTop: globals.spacing.sm,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: globals.radius.full,
  },
  progressSegmentDone: {
    backgroundColor: globals.colors.primary,
  },
  progressSegmentPending: {
    backgroundColor: globals.colors.secondary,
  },
  titleBlock: {
    marginTop: globals.spacing.lg,
    marginBottom: globals.spacing.lg,
  },
  title: {
    fontSize: globals.fontSize.xl,
    fontWeight: '700',
    color: globals.colors.text,
    marginBottom: globals.spacing.xs,
  },
  subtitle: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
  },
  group: {
    gap: globals.spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.lg,
    paddingHorizontal: globals.spacing.md,
    paddingVertical: globals.spacing.md,
    backgroundColor: globals.colors.background,
    minHeight: 52,
  },
  optionSelected: {
    borderColor: globals.colors.primary,
    borderWidth: 1.5,
  },
  optionText: {
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
  },
  optionTextSelected: {
    color: globals.colors.text,
    fontWeight: '600',
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: globals.radius.full,
    backgroundColor: globals.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkMark: {
    color: globals.colors.background,
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    textAlign: 'center',
    marginTop: globals.spacing.md,
  },
  continueButton: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.lg,
    paddingVertical: globals.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: globals.spacing.xl,
    minHeight: 50,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    color: globals.colors.background,
    fontSize: globals.fontSize.md,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: globals.spacing.lg,
  },
  successIconOuter: {
    width: 120,
    height: 120,
    borderRadius: globals.radius.full,
    backgroundColor: globals.colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: globals.spacing.lg,
  },
  successIconInner: {
    width: 72,
    height: 72,
    borderRadius: globals.radius.full,
    backgroundColor: globals.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successCheck: {
    color: globals.colors.background,
    fontSize: 32,
    fontWeight: '700',
  },
  successTitle: {
    fontSize: globals.fontSize.xl,
    fontWeight: '700',
    color: globals.colors.text,
    marginBottom: globals.spacing.sm,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: globals.fontSize.md,
    color: globals.colors.textMuted,
    textAlign: 'center',
    marginBottom: globals.spacing.xl,
    paddingHorizontal: globals.spacing.md,
  },
  successButton: {
    width: '100%',
    marginTop: 0,
  },
});
