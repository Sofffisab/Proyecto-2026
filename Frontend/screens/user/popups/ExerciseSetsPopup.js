// src/screens/user/popups/ExerciseSetsPopup.js
//
// Pencil button on a day's exercise row: edits its sets and reps.

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../../styles/globals';
import { useTranslation } from '../../../i18n/I18nContext';

/**
 * @param {string} exerciseName
 * @param {number|string} initialSets
 * @param {string} initialReps - Free text range, e.g. "10-12".
 * @param {function} onSave - ({ sets, reps }) => void
 * @param {function} onClose
 */
export default function ExerciseSetsPopup({ exerciseName, initialSets, initialReps, onSave, onClose }) {
  const { t } = useTranslation();

  const [sets, setSets] = useState(String(initialSets ?? ''));
  const [reps, setReps] = useState(initialReps ?? '');

  const parsedSets = parseInt(sets, 10);
  const canSave = parsedSets > 0 && reps.trim().length > 0;

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title} numberOfLines={2}>{exerciseName}</Text>

        <Text style={styles.label}>{t('user.routines.popups.sets.setsLabel')}</Text>
        <TextInput
          style={styles.input}
          value={sets}
          onChangeText={(value) => setSets(value.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          maxLength={2}
        />

        <Text style={styles.label}>{t('user.routines.popups.sets.repsLabel')}</Text>
        <TextInput style={styles.input} value={reps} onChangeText={setReps} maxLength={10} />

        <TouchableOpacity
          style={[styles.submitButton, !canSave && styles.submitButtonDisabled]}
          onPress={() => onSave({ sets: parsedSets, reps: reps.trim() })}
          disabled={!canSave}
        >
          <Text style={styles.submitButtonText}>{t('common.save')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeLink}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '85%',
    backgroundColor: globals.colors.background,
    borderRadius: globals.radius.lg,
    padding: globals.spacing.lg,
  },
  title: {
    fontSize: globals.fontSize.lg,
    fontWeight: 'bold',
    color: globals.colors.text,
    marginBottom: globals.spacing.md,
    textAlign: 'center',
  },
  label: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textSecondary,
    marginBottom: globals.spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    padding: globals.spacing.sm,
    color: globals.colors.text,
    marginBottom: globals.spacing.md,
  },
  submitButton: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.md,
    alignItems: 'center',
    marginBottom: globals.spacing.sm,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: '#fff', fontWeight: '600' },
  closeLink: { textAlign: 'center', color: globals.colors.textMuted },
});
