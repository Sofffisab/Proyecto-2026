// src/screens/user/RoutineDayScreen.js
//
// A single day of the schedule (screen 3). Empty until exercises are added
// through "Seleccionar ejercicio" (screen 4). Edits live in the draft held by
// RoutinesContext and only reach the schedule when "Guardar" is pressed.
// Exercises can be reordered by dragging the 3-lines handle; the pencil edits
// an exercise's sets and reps.

import React, { useEffect, useState } from 'react';
import { View, Text, Image, TextInput, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import Header from '../../components/common/Header';
import ReorderableList from '../../components/common/ReorderableList';
import ExerciseSetsPopup from './popups/ExerciseSetsPopup';
import { useTranslation } from '../../i18n/I18nContext';
import { useRoutines } from '../../context/RoutinesContext';
import { capitalize, fromDateKey, getDateParts } from '../../utils/schedule';

const TITLE_MAX_LENGTH = 40;
const ROW_HEIGHT = 66;
const ROW_GAP = 12;

/**
 * @param {string} dateKey - "YYYY-MM-DD" of the day being edited.
 * @param {function} [onBack]
 * @param {function} [onSave] - Called after the day was saved.
 * @param {function} [onAddExercises] - "Agregar ejercicios" -> selector screen.
 */
export default function RoutineDayScreen({ dateKey, onBack, onSave, onAddExercises }) {
  const { t, language } = useTranslation();
  const { draft, openDraft, updateDraft, discardDraft, saveDraft, getExercise } = useRoutines();

  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [editingId, setEditingId] = useState(null);

  // Starts the draft when the screen opens and drops it when it closes
  // (the selector screen is pushed on top, so this one stays mounted).
  useEffect(() => {
    openDraft(dateKey);
    return () => discardDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  const parts = getDateParts(fromDateKey(dateKey), language);
  const title = draft?.title ?? '';
  const exercises = draft?.exercises ?? [];
  const editingExercise = exercises.find((ex) => ex.id === editingId) ?? null;

  const exerciseName = (id) => {
    const exercise = getExercise(id);
    if (!exercise) return '';
    return exercise.isCustom ? exercise.name : t(`user.routines.exercises.${id}.name`);
  };

  const handleSave = () => {
    saveDraft();
    if (onSave) onSave();
  };

  const handleSaveSets = ({ sets, reps }) => {
    updateDraft({ exercises: exercises.map((ex) => (ex.id === editingId ? { ...ex, sets, reps } : ex)) });
    setEditingId(null);
  };

  const renderExercise = ({ item, index, dragHandleProps }) => {
    const exercise = getExercise(item.id);
    const image = exercise?.isCustom ? (exercise.imageUri ? { uri: exercise.imageUri } : null) : exercise?.image;
    return (
      <View style={styles.exerciseRow}>
        <Text style={styles.exerciseIndex}>{index + 1}</Text>
        {image ? <Image source={image} style={styles.exerciseImage} /> : <View style={[styles.exerciseImage, styles.exerciseImageEmpty]} />}
        <View style={styles.exerciseInfo}>
          <Text style={styles.exerciseName} numberOfLines={1}>{exerciseName(item.id)}</Text>
          <Text style={styles.exerciseMeta}>
            {t('user.routines.setsAndReps', { sets: item.sets, reps: item.reps })}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setEditingId(item.id)} hitSlop={8}>
          <Image source={require('../../assets/Group 69.png')} style={styles.editIcon} />
        </TouchableOpacity>
        <View style={styles.handle} {...dragHandleProps}>
          <Image source={require('../../assets/Group 31 (6).png')} style={styles.handleIcon} />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        pageTitle={t('user.routines.dayTitle', { ...parts, weekday: capitalize(parts.weekday) })}
        onBack={onBack}
        rightLabel={t('common.save')}
        onPressRight={handleSave}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.fieldLabel}>{t('user.routines.dayTitleLabel')}</Text>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={(value) => updateDraft({ title: value })}
          maxLength={TITLE_MAX_LENGTH}
        />
        <Text style={styles.counter}>{title.length}/{TITLE_MAX_LENGTH}</Text>

        <View style={styles.exercisesHeader}>
          <View>
            <Text style={styles.exercisesTitle}>{t('user.routines.exercisesTitle')}</Text>
            <Text style={styles.exercisesCount}>{t('user.home.exercisesCount', { count: exercises.length })}</Text>
          </View>
          <Image
            source={title.trim() ? require('../../assets/Group 48.png') : require('../../assets/basil_check-solid.png')}
            style={styles.statusIcon}
          />
        </View>

        <ReorderableList
          data={exercises}
          keyExtractor={(item) => item.id}
          renderItem={renderExercise}
          itemHeight={ROW_HEIGHT}
          gap={ROW_GAP}
          onReorder={(next) => updateDraft({ exercises: next })}
          onDragStateChange={(isDragging) => setScrollEnabled(!isDragging)}
        />

        {/* Static for now. */}
        <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.8}>
          <Text style={styles.secondaryButtonText}>{t('user.routines.doWithAi')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.8}>
          <Text style={styles.secondaryButtonText}>{t('user.routines.pickDefault')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.addButton} onPress={onAddExercises}>
          <Text style={styles.addButtonText}>{t('user.routines.addExercises')}</Text>
        </TouchableOpacity>
      </View>

      <Modal transparent animationType="fade" visible={editingExercise != null} onRequestClose={() => setEditingId(null)}>
        {editingExercise && (
          <ExerciseSetsPopup
            exerciseName={exerciseName(editingExercise.id)}
            initialSets={editingExercise.sets}
            initialReps={editingExercise.reps}
            onSave={handleSaveSets}
            onClose={() => setEditingId(null)}
          />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: globals.colors.backgroundAlt },
  content: { flex: 1 },
  contentInner: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: globals.spacing.lg },

  fieldLabel: { fontSize: 12, color: globals.colors.textSecondary, marginBottom: 8 },
  titleInput: {
    height: 57,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#CFCFCF',
    backgroundColor: globals.colors.surface,
    paddingHorizontal: 15,
    fontSize: 16,
    fontWeight: '600',
    color: globals.colors.text,
  },
  counter: { textAlign: 'right', fontSize: 12, color: globals.colors.textSecondary, marginTop: 5 },

  exercisesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 14,
  },
  exercisesTitle: { fontSize: 18, fontWeight: '700', color: globals.colors.text },
  exercisesCount: { fontSize: 10, color: globals.colors.textSecondary, marginTop: 2 },
  statusIcon: { width: 24, height: 24, resizeMode: 'contain' },

  exerciseRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: globals.colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    ...globals.shadow.card,
  },
  exerciseIndex: { width: 14, fontSize: 11, fontWeight: '600', color: globals.colors.text },
  exerciseImage: { width: 44, height: 44, borderRadius: 8, marginHorizontal: 8 },
  exerciseImageEmpty: { backgroundColor: globals.colors.backgroundAlt },
  exerciseInfo: { flex: 1 },
  exerciseName: { fontSize: 13, fontWeight: '700', color: globals.colors.text },
  exerciseMeta: { fontSize: 10, color: globals.colors.textSecondary, marginTop: 3 },
  editIcon: { width: 22, height: 22, resizeMode: 'contain', marginHorizontal: 10 },
  handle: { padding: 6 },
  handleIcon: { width: 15, height: 12, resizeMode: 'contain' },

  secondaryButton: {
    borderWidth: 1,
    borderColor: globals.colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: globals.colors.surface,
    marginTop: 14,
  },
  secondaryButtonText: { color: globals.colors.primary, fontSize: 13, fontWeight: '600' },

  footer: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 24, backgroundColor: globals.colors.backgroundAlt },
  addButton: {
    backgroundColor: globals.colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    ...globals.shadow.button,
  },
  addButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
