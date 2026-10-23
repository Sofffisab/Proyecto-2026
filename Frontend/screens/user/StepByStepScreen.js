// src/screens/user/StepByStepScreen.js
//
// "Paso a paso": the current exercise is shown big; marking it as done makes
// the next one big and the finished one small again. Nothing is editable.
// Finishing the last exercise of a default routine records it as done, so the
// random pick of default routines can favour the ones not done yet.

import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import Header from '../../components/common/Header';
import RoutineOverview from '../../components/user/RoutineOverview';
import RoutineExerciseRow from '../../components/user/RoutineExerciseRow';
import { useTranslation } from '../../i18n/I18nContext';
import { useRoutines } from '../../context/RoutinesContext';
import { ROUTINE_SOURCES } from '../../constants/generalRoutines';
import { capitalize, fromDateKey, getDateParts, resolveRoutineTitle } from '../../utils/schedule';

/**
 * @param {string} source - One of ROUTINE_SOURCES.
 * @param {string} dateKey - "YYYY-MM-DD" shown in the header.
 * @param {string} [generalRoutineId] - When source is GENERAL.
 * @param {function} [onBack]
 * @param {function} [onOpenCamera]
 */
export default function StepByStepScreen({ source, dateKey, generalRoutineId, onBack, onOpenCamera }) {
  const { t, language } = useTranslation();
  const { getRoutine, completeGeneralRoutine } = useRoutines();

  // Index of the exercise shown big; equals exercises.length once all are done.
  const [currentIndex, setCurrentIndex] = useState(0);

  const routine = getRoutine({ source, dateKey, generalRoutineId });
  const exercises = routine?.exercises ?? [];
  const parts = getDateParts(fromDateKey(dateKey), language);

  const handleComplete = () => {
    const next = currentIndex + 1;
    setCurrentIndex(next);
    if (next === exercises.length && source === ROUTINE_SOURCES.GENERAL) {
      completeGeneralRoutine(generalRoutineId);
    }
  };

  return (
    <View style={styles.container}>
      <Header pageTitle={t('user.routines.dayTitle', { ...parts, weekday: capitalize(parts.weekday) })} onBack={onBack} />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
        {routine && (
          <>
            <RoutineOverview title={resolveRoutineTitle(routine, t)} exerciseCount={exercises.length} />
            {exercises.map((item, index) => (
              <View key={item.id} style={styles.rowWrapper}>
                <RoutineExerciseRow
                  item={item}
                  expanded={index === currentIndex}
                  onOpenCamera={onOpenCamera}
                  onComplete={handleComplete}
                />
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: globals.colors.background },
  content: { flex: 1 },
  contentInner: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: globals.spacing.lg },
  rowWrapper: { marginBottom: 12 },
});
