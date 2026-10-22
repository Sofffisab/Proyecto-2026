// src/screens/user/popups/EmptyRoutinePopup.js
//
// Shown when the person taps "Paso a paso" / "Seguir libre" on a day that
// has no routine yet: build it by hand, generate it with the personalized AI
// or cancel (close the pop-up and drop the action).

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../../styles/globals';
import { useTranslation } from '../../../i18n/I18nContext';

/**
 * @param {function} onDoIt - "Do it myself" -> goes to the day screen.
 * @param {function} onGenerateWithAi - "Generate with personalized AI".
 * @param {function} onCancel - Closes the pop-up without doing anything.
 */
export default function EmptyRoutinePopup({ onDoIt, onGenerateWithAi, onCancel }) {
  const { t } = useTranslation();

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>{t('user.routines.popups.empty.title')}</Text>
        <Text style={styles.message}>{t('user.routines.popups.empty.message')}</Text>

        <TouchableOpacity style={styles.primaryButton} onPress={onDoIt}>
          <Text style={styles.primaryButtonText}>{t('user.routines.popups.empty.doIt')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={onGenerateWithAi}>
          <Text style={styles.primaryButtonText}>{t('user.routines.popups.empty.generateWithAi')}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.cancelLink}>{t('common.cancel')}</Text>
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
    marginBottom: globals.spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textSecondary,
    textAlign: 'center',
    marginBottom: globals.spacing.md,
  },
  primaryButton: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.md,
    alignItems: 'center',
    marginBottom: globals.spacing.sm,
    ...globals.shadow.button,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  cancelLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginTop: globals.spacing.xs,
  },
});
