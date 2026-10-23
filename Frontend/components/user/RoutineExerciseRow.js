// src/components/user/RoutineExerciseRow.js
//
// Read-only exercise card for the free-mode and step-by-step screens.
//   - compact:  image + name + "4 series · 8-10 rep"
//   - expanded: (step by step, current exercise) big image, name, an
//     "Instrucciones" box, sets/reps, plus camera and "mark as done" buttons.

import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import { useRoutines } from '../../context/RoutinesContext';

/**
 * @param {{id: string, sets: number, reps: string}} item
 * @param {number} [index] - 0-based position; when given, the number is shown.
 * @param {boolean} [expanded]
 * @param {function} [onOpenCamera] - expanded only
 * @param {function} [onComplete] - expanded only: marks the exercise as done
 */
export default function RoutineExerciseRow({ item, index, expanded = false, onOpenCamera, onComplete }) {
  const { t } = useTranslation();
  const { getExercise } = useRoutines();

  const exercise = getExercise(item.id);
  const name = exercise?.isCustom ? exercise.name : t(`user.routines.exercises.${item.id}.name`);
  const description = exercise?.isCustom ? exercise.description : t(`user.routines.exercises.${item.id}.description`);
  const image = exercise?.isCustom ? (exercise.imageUri ? { uri: exercise.imageUri } : null) : exercise?.image;
  const meta = t('user.routines.setsAndReps', { sets: item.sets, reps: item.reps });

  if (expanded) {
    return (
      <View style={styles.expandedCard}>
        {image ? <Image source={image} style={styles.expandedImage} /> : <View style={[styles.expandedImage, styles.imageEmpty]} />}
        <View style={styles.expandedInfo}>
          <Text style={styles.expandedName} numberOfLines={2}>{name}</Text>
          <View style={styles.instructionsBox}>
            <Text style={styles.instructionsLabel}>{t('user.routines.instructions')}</Text>
            {Boolean(description) && <Text style={styles.instructionsText} numberOfLines={3}>{description}</Text>}
          </View>
          <View style={styles.expandedFooter}>
            <Text style={styles.meta}>{meta}</Text>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cameraSquare} onPress={onOpenCamera}>
                <Image source={require('../../assets/icono_camara.png')} style={styles.cameraSquareIcon} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onComplete} hitSlop={8}>
                <Text style={styles.checkMark}>✓</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.compactRow}>
      {index != null && <Text style={styles.index}>{index + 1}</Text>}
      {image ? <Image source={image} style={styles.compactImage} /> : <View style={[styles.compactImage, styles.imageEmpty]} />}
      <View style={styles.compactInfo}>
        <Text style={styles.compactName} numberOfLines={1}>{name}</Text>
        <Text style={styles.meta}>{meta}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  imageEmpty: { backgroundColor: globals.colors.backgroundAlt },
  meta: { fontSize: 10, color: globals.colors.textSecondary },

  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 66,
    backgroundColor: globals.colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    ...globals.shadow.card,
  },
  index: { width: 14, fontSize: 11, fontWeight: '600', color: globals.colors.text },
  compactImage: { width: 44, height: 44, borderRadius: 8, marginHorizontal: 8 },
  compactInfo: { flex: 1, gap: 3 },
  compactName: { fontSize: 13, fontWeight: '700', color: globals.colors.text },

  expandedCard: {
    flexDirection: 'row',
    backgroundColor: globals.colors.surface,
    borderRadius: 12,
    padding: 10,
    ...globals.shadow.card,
  },
  expandedImage: { width: 100, height: 170, borderRadius: 8 },
  expandedInfo: { flex: 1, marginLeft: 12 },
  expandedName: { fontSize: 14, fontWeight: '700', color: globals.colors.text },
  instructionsBox: {
    flex: 1,
    backgroundColor: '#EEF2F3',
    borderRadius: 6,
    padding: 8,
    marginVertical: 8,
  },
  instructionsLabel: { fontSize: 10, fontWeight: '600', color: globals.colors.textSecondary },
  instructionsText: { fontSize: 10, color: globals.colors.textSecondary, marginTop: 4 },
  expandedFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cameraSquare: {
    width: 32,
    height: 28,
    borderRadius: 7,
    backgroundColor: globals.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraSquareIcon: { width: 18, height: 18, resizeMode: 'contain' },
  checkMark: { fontSize: 22, fontWeight: '700', color: globals.colors.primary },
});
