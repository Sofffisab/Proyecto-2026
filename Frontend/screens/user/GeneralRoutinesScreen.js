// src/screens/user/GeneralRoutinesScreen.js
//
// Lists the default ("general") routines stored in the database; tapping one assigns it to today and
// makes "rutinas generales" the followed option on the Routines screen.

import React, { useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import Header from '../../components/common/Header';
import { useTranslation } from '../../i18n/I18nContext';
import { useRoutines } from '../../context/RoutinesContext';
import { toDateKey } from '../../utils/schedule';

/**
 * @param {function} [onBack]
 * @param {function} [onDone] - Called after a routine was picked.
 */
export default function GeneralRoutinesScreen({ onBack, onDone }) {
  const { t } = useTranslation();
  const { getGeneralChoice, chooseGeneralRoutine, generalRoutines, generalStatus, loadGeneralRoutines } = useRoutines();

  // Always show what the database has right now.
  useEffect(() => {
    loadGeneralRoutines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const todayKey = toDateKey(new Date());
  const currentId = getGeneralChoice(todayKey);

  const handlePick = (routineId) => {
    chooseGeneralRoutine(todayKey, routineId);
    if (onDone) onDone();
  };

  return (
    <View style={styles.container}>
      <Header pageTitle={t('user.routines.generalRoutinesTitle')} onBack={onBack} />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
        {generalStatus.loading && generalRoutines.length === 0 && (
          <ActivityIndicator color={globals.colors.primary} style={styles.loader} />
        )}
        {generalStatus.error && generalRoutines.length === 0 && (
          <TouchableOpacity onPress={loadGeneralRoutines}>
            <Text style={styles.message}>{t('user.routines.loadError')} · {t('user.routines.retry')}</Text>
          </TouchableOpacity>
        )}
        {!generalStatus.loading && !generalStatus.error && generalRoutines.length === 0 && (
          <Text style={styles.message}>{t('user.routines.pickDefaultEmpty')}</Text>
        )}
        {generalRoutines.map((routine) => (
          <TouchableOpacity
            key={routine.id}
            style={[styles.row, (routine.id === currentId || routine.slug === currentId) && styles.rowSelected]}
            onPress={() => handlePick(routine.id)}
            activeOpacity={0.8}
          >
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={1}>{routine.title}</Text>
              <Text style={styles.meta}>
                {`${t('user.home.durationMinutes', { count: routine.estimatedMinutes })}  ·  ${t('user.home.exercisesCount', { count: routine.exerciseCount })}`}
              </Text>
            </View>
            <Image source={require('../../assets/derecha.png')} style={styles.chevron} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: globals.colors.background },
  content: { flex: 1 },
  contentInner: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: globals.spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    backgroundColor: globals.colors.surface,
    borderWidth: 1,
    borderColor: globals.colors.surfaceBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    ...globals.shadow.card,
  },
  rowSelected: { borderColor: globals.colors.primary },
  info: { flex: 1 },
  title: { fontSize: 13, fontWeight: '700', color: globals.colors.text },
  meta: { fontSize: 10, color: globals.colors.textSecondary, marginTop: 3 },
  loader: { marginVertical: 24 },
  message: { textAlign: 'center', color: globals.colors.textSecondary, fontSize: 13, marginVertical: 24 },
  chevron: { width: 18, height: 18, resizeMode: 'contain' },
});
