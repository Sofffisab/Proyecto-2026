// src/screens/user/FreeRoutineScreen.js
//
// "Free mode": a static, read-only view of the day's routine (nothing can be
// edited here; the person can only stay or leave). The only action is the
// round camera button, which opens the camera. With "Don't follow a routine"
// there is no routine, so only the camera button is shown.

import React from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import Header from '../../components/common/Header';
import RoutineOverview from '../../components/user/RoutineOverview';
import RoutineExerciseRow from '../../components/user/RoutineExerciseRow';
import { useTranslation } from '../../i18n/I18nContext';
import { useLoadRoutine } from '../../context/RoutinesContext';
import { capitalize, fromDateKey, getDateParts, resolveRoutineTitle } from '../../utils/schedule';

/**
 * @param {string} source - One of ROUTINE_SOURCES.
 * @param {string} dateKey - "YYYY-MM-DD" shown in the header.
 * @param {string} [generalRoutineId] - When source is GENERAL.
 * @param {function} [onBack]
 * @param {function} [onOpenCamera]
 */
export default function FreeRoutineScreen({ source, dateKey, generalRoutineId, onBack, onOpenCamera }) {
  const { t, language } = useTranslation();
  const { routine, loading, error, reload } = useLoadRoutine({ source, dateKey, generalRoutineId });
  const exercises = routine?.exercises ?? [];
  const parts = getDateParts(fromDateKey(dateKey), language);

  return (
    <View style={styles.container}>
      <Header pageTitle={t('user.routines.dayTitle', { ...parts, weekday: capitalize(parts.weekday) })} onBack={onBack} />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
        {loading && <ActivityIndicator color={globals.colors.primary} style={styles.loader} />}
        {!loading && error && (
          <TouchableOpacity onPress={reload}>
            <Text style={styles.message}>{t('user.routines.loadError')} · {t('user.routines.retry')}</Text>
          </TouchableOpacity>
        )}
        {!loading && !error && routine && (
          <>
            <RoutineOverview title={resolveRoutineTitle(routine, t)} exerciseCount={exercises.length} />
            {exercises.map((item, index) => (
              <View key={item.id} style={styles.rowWrapper}>
                <RoutineExerciseRow item={item} index={index} />
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.cameraButton} onPress={onOpenCamera}>
          <Image source={require('../../assets/icono_camara.png')} style={styles.cameraIcon} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: globals.colors.background },
  content: { flex: 1 },
  contentInner: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: globals.spacing.lg },
  loader: { marginVertical: 32 },
  message: { textAlign: 'center', color: globals.colors.textSecondary, fontSize: 13, marginVertical: 32 },
  rowWrapper: { marginBottom: 12 },
  footer: { alignItems: 'center', paddingTop: 10, paddingBottom: 28 },
  cameraButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: globals.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...globals.shadow.button,
  },
  cameraIcon: { width: 30, height: 30, resizeMode: 'contain' },
});
