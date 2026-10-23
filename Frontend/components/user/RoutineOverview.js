// src/components/user/RoutineOverview.js
//
// Read-only block shared by the free-mode and step-by-step screens: the
// day's title (static field) followed by the "Ejercicios / N ejercicios" label.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * @param {string} title - Routine title shown in the static field.
 * @param {number} exerciseCount
 */
export default function RoutineOverview({ title, exerciseCount }) {
  const { t } = useTranslation();

  return (
    <View>
      <Text style={styles.fieldLabel}>{t('user.routines.dayTitleLabel')}</Text>
      <View style={styles.titleBox}>
        <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
      </View>

      <View style={styles.exercisesHeader}>
        <Text style={styles.exercisesTitle}>{t('user.routines.exercisesTitle')}</Text>
        <Text style={styles.exercisesCount}>{t('user.home.exercisesCount', { count: exerciseCount })}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { fontSize: 12, color: globals.colors.textSecondary, marginBottom: 8 },
  titleBox: {
    height: 57,
    borderRadius: 10,
    backgroundColor: '#EEF2F3',
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  titleText: { fontSize: 14, fontWeight: '600', color: globals.colors.text },
  exercisesHeader: { marginTop: 18, marginBottom: 14 },
  exercisesTitle: { fontSize: 18, fontWeight: '700', color: globals.colors.text },
  exercisesCount: { fontSize: 10, color: globals.colors.textSecondary, marginTop: 2 },
});
