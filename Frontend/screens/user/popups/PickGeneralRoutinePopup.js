// src/screens/user/popups/PickGeneralRoutinePopup.js
//
// "Elegir para este día una default": lists the general routines stored in the
// database; picking one copies its exercises into the day being edited.

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import globals from '../../../styles/globals';
import { useTranslation } from '../../../i18n/I18nContext';

/**
 * @param {Array} routines - [{ id, title, exerciseCount, estimatedMinutes }]
 * @param {boolean} loading - Routines are still being fetched.
 * @param {string|null} busyId - Routine whose exercises are being fetched.
 * @param {function} onSelect - (routineId) => void
 * @param {function} onClose
 */
export default function PickGeneralRoutinePopup({ routines, loading, busyId, onSelect, onClose }) {
  const { t } = useTranslation();

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>{t('user.routines.pickDefaultTitle')}</Text>

        {loading ? (
          <ActivityIndicator color={globals.colors.primary} style={styles.loader} />
        ) : routines.length === 0 ? (
          <Text style={styles.empty}>{t('user.routines.pickDefaultEmpty')}</Text>
        ) : (
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {routines.map((routine) => (
              <TouchableOpacity
                key={routine.id}
                style={styles.row}
                activeOpacity={0.8}
                disabled={busyId != null}
                onPress={() => onSelect(routine.id)}
              >
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{routine.title}</Text>
                  <Text style={styles.rowMeta}>
                    {t('user.home.exercisesCount', { count: routine.exerciseCount })}
                    {' · '}
                    {t('user.home.durationMinutes', { count: routine.estimatedMinutes })}
                  </Text>
                </View>
                {busyId === routine.id && <ActivityIndicator color={globals.colors.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <TouchableOpacity onPress={onClose} disabled={busyId != null}>
          <Text style={styles.closeLink}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: globals.colors.surface,
    borderRadius: 14,
    padding: 20,
    maxHeight: '75%',
  },
  title: { fontSize: 16, fontWeight: '700', color: globals.colors.text, marginBottom: 14, textAlign: 'center' },
  loader: { marginVertical: 24 },
  empty: { textAlign: 'center', color: globals.colors.textSecondary, marginVertical: 24, fontSize: 13 },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E3E3E3',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: globals.colors.text },
  rowMeta: { fontSize: 11, color: globals.colors.textSecondary, marginTop: 3 },
  closeLink: { textAlign: 'center', color: globals.colors.textSecondary, fontSize: 13, marginTop: 10 },
});
