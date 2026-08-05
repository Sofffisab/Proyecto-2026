import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Minimal Profile Personalization (User) - spec sections 4, 5, 6 y 7.
 * Four separate screens, each with a single selector and its own Back
 * button, only shown the first time the user role logs in. They only
 * appear again on subsequent logins if the profile is still incomplete.
 *
 * Selections map exactly to the Backend enums (see
 * Backend/prisma/schema.prisma and Backend/src/validators/user.schemas.js):
 *   - mainGoal        -> objectives: MainGoal[]        (single-select, one value)
 *   - currentLevel    -> trainingLevel: ExperienceLevel (single-select)
 *   - daysPerWeek     -> weeklyTrainingDays: TrainingFrequency (single-select)
 *   - trainingType    -> trainingType: TrainingType     (single-select)
 */
const GOAL_KEYS = ['LOSE_WEIGHT', 'GAIN_MUSCLE', 'IMPROVE_HEALTH', 'INCREASE_ENDURANCE'];
const LEVEL_KEYS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const DAYS_KEYS = ['ONE_TO_TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN'];
const TRAINING_TYPE_KEYS = ['STRENGTH', 'CARDIO', 'FUNCTIONAL', 'MIXED'];

/** Shared single-select step screen (pantalla 4/5/6/7). */
function OnboardingStepScreen({ titleKey, i18nGroup, optionKeys, value, onSelect, onContinue, onBack, loading, error }) {
  const { t } = useTranslation();
  const options = optionKeys.map((key) => ({ key, label: t(`user.onboarding.${i18nGroup}.${key}`) }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={onBack} disabled={loading}>
        <Text style={styles.backText}>{t('user.onboarding.back')}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{t(titleKey)}</Text>

      <View style={styles.group}>
        {options.map(({ key, label }) => {
          const isSelected = value === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.option, isSelected && styles.optionSelected]}
              onPress={() => onSelect(key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                {isSelected ? '● ' : '○ '}
                {label}
              </Text>
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

/** Pantalla 4: Selector de Objetivo principal (4 opciones). */
export function OnboardingGoalScreen({ value, onSelect, onContinue, onBack, loading, error }) {
  return (
    <OnboardingStepScreen
      titleKey="user.onboarding.mainGoal"
      i18nGroup="goals"
      optionKeys={GOAL_KEYS}
      value={value}
      onSelect={onSelect}
      onContinue={onContinue}
      onBack={onBack}
      loading={loading}
      error={error}
    />
  );
}

/** Pantalla 5: Selector de Nivel actual (3 opciones). */
export function OnboardingLevelScreen({ value, onSelect, onContinue, onBack, loading, error }) {
  return (
    <OnboardingStepScreen
      titleKey="user.onboarding.currentLevel"
      i18nGroup="levels"
      optionKeys={LEVEL_KEYS}
      value={value}
      onSelect={onSelect}
      onContinue={onContinue}
      onBack={onBack}
      loading={loading}
      error={error}
    />
  );
}

/** Pantalla 6: Selector de días de entrenamiento por semana (6 opciones). */
export function OnboardingDaysScreen({ value, onSelect, onContinue, onBack, loading, error }) {
  return (
    <OnboardingStepScreen
      titleKey="user.onboarding.daysPerWeek"
      i18nGroup="days"
      optionKeys={DAYS_KEYS}
      value={value}
      onSelect={onSelect}
      onContinue={onContinue}
      onBack={onBack}
      loading={loading}
      error={error}
    />
  );
}

/** Pantalla 7: Selector de tipo de entrenamiento buscado (4 opciones). */
export function OnboardingTypeScreen({ value, onSelect, onContinue, onBack, loading, error }) {
  return (
    <OnboardingStepScreen
      titleKey="user.onboarding.trainingType"
      i18nGroup="trainingTypes"
      optionKeys={TRAINING_TYPE_KEYS}
      value={value}
      onSelect={onSelect}
      onContinue={onContinue}
      onBack={onBack}
      loading={loading}
      error={error}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: globals.colors.background,
  },
  content: {
    padding: globals.spacing.md,
    gap: globals.spacing.md,
  },
  title: {
    fontSize: globals.fontSize.lg,
    fontWeight: '700',
    color: globals.colors.text,
  },
  group: {
    marginTop: globals.spacing.sm,
    gap: globals.spacing.xs,
  },
  option: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    paddingHorizontal: globals.spacing.md,
    paddingVertical: globals.spacing.sm,
    backgroundColor: globals.colors.secondary,
  },
  optionSelected: {
    borderColor: globals.colors.primary,
    backgroundColor: globals.colors.primary + '20',
  },
  optionText: {
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
  },
  optionTextSelected: {
    color: globals.colors.primary,
    fontWeight: '600',
  },
  errorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    textAlign: 'center',
  },
  continueButton: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: globals.spacing.md,
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
  backText: {
    color: globals.colors.primary,
    fontSize: globals.fontSize.sm,
    paddingVertical: globals.spacing.sm,
  },
});
