// src/screens/user/SelectExerciseScreen.js
//
// "Seleccionar ejercicio" (screen 4). Lists the app's default exercises plus
// the person's own ones; "+" toggles an exercise and "Agregar ejercicios"
// adds every toggled one to the day being edited (the draft in
// RoutinesContext). A card at the end of the list creates a new own exercise.

import React, { useState } from 'react';
import { View, Text, Image, TextInput, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import Header from '../../components/common/Header';
import CustomExercisePopup from './popups/CustomExercisePopup';
import { useTranslation } from '../../i18n/I18nContext';
import { useRoutines } from '../../context/RoutinesContext';
import { DEFAULT_EXERCISES, MUSCLE_GROUPS } from '../../constants/exercises';

const FILTERS = {
  ALL: 'all',
  CHEST: MUSCLE_GROUPS.CHEST,
  TRICEPS: MUSCLE_GROUPS.TRICEPS,
  FAVORITES: 'favorites',
};

/**
 * @param {function} [onBack]
 * @param {function} [onDone] - Called after the selected exercises were added.
 */
export default function SelectExerciseScreen({ onBack, onDone }) {
  const { t } = useTranslation();
  const { draft, customExercises, addCustomExercise, addToDraft } = useRoutines();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(FILTERS.ALL);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showCustomPopup, setShowCustomPopup] = useState(false);

  const filterOptions = [
    { key: FILTERS.ALL, label: t('user.routines.filters.all') },
    { key: FILTERS.CHEST, label: t('user.routines.filters.chest') },
    { key: FILTERS.TRICEPS, label: t('user.routines.filters.triceps') },
    { key: FILTERS.FAVORITES, label: t('user.routines.filters.favorites') },
  ];

  const nameOf = (exercise) => (exercise.isCustom ? exercise.name : t(`user.routines.exercises.${exercise.id}.name`));

  // Exercises already in the day are not offered again.
  const takenIds = (draft?.exercises ?? []).map((ex) => ex.id);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleExercises = [...DEFAULT_EXERCISES, ...customExercises].filter((exercise) => {
    if (takenIds.includes(exercise.id)) return false;
    if (normalizedQuery && !nameOf(exercise).toLowerCase().includes(normalizedQuery)) return false;
    if (filter === FILTERS.ALL) return true;
    if (filter === FILTERS.FAVORITES) return Boolean(exercise.isFavorite);
    return exercise.muscles.includes(filter);
  });

  const toggleSelected = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleConfirm = () => {
    addToDraft(selectedIds);
    if (onDone) onDone();
  };

  const handleCreateCustom = ({ name, description, imageUri }) => {
    const created = addCustomExercise({ name, description, imageUri });
    setSelectedIds((prev) => [...prev, created.id]);
    setShowCustomPopup(false);
  };

  return (
    <View style={styles.container}>
      <Header pageTitle={t('user.routines.selectExerciseTitle')} onBack={onBack} />

      <View style={styles.searchBox}>
        <Image source={require('../../assets/basil_search-outline.png')} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={t('user.routines.searchPlaceholder')}
          placeholderTextColor={globals.colors.textSecondary}
        />
      </View>

      <View style={styles.filtersRow}>
        {filterOptions.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.chip, filter === opt.key && styles.chipSelected]}
            onPress={() => setFilter(opt.key)}
          >
            <Text style={[styles.chipText, filter === opt.key && styles.chipTextSelected]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
        {visibleExercises.length === 0 && <Text style={styles.emptyText}>{t('user.routines.noExercisesFound')}</Text>}
        {visibleExercises.map((exercise) => {
          const selected = selectedIds.includes(exercise.id);
          const image = exercise.isCustom ? (exercise.imageUri ? { uri: exercise.imageUri } : null) : exercise.image;
          return (
            <View key={exercise.id} style={styles.exerciseRow}>
              {image ? <Image source={image} style={styles.exerciseImage} /> : <View style={[styles.exerciseImage, styles.exerciseImageEmpty]} />}
              <Text style={styles.exerciseName} numberOfLines={2}>{nameOf(exercise)}</Text>
              <TouchableOpacity onPress={() => toggleSelected(exercise.id)} hitSlop={8}>
                <Image
                  source={selected ? require('../../assets/botones.png') : require('../../assets/boton_agregar_gris.png')}
                  style={styles.addIcon}
                />
              </TouchableOpacity>
            </View>
          );
        })}

        <TouchableOpacity style={styles.customCard} onPress={() => setShowCustomPopup(true)} activeOpacity={0.8}>
          <Text style={styles.customCardText}>{t('user.routines.createCustomExercise')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmButton, selectedIds.length === 0 && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={selectedIds.length === 0}
        >
          <Text style={styles.confirmButtonText}>{t('user.routines.addExercises')}</Text>
        </TouchableOpacity>
      </View>

      <Modal transparent animationType="fade" visible={showCustomPopup} onRequestClose={() => setShowCustomPopup(false)}>
        <CustomExercisePopup onSave={handleCreateCustom} onClose={() => setShowCustomPopup(false)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: globals.colors.background },
  content: { flex: 1 },
  contentInner: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: globals.spacing.lg },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: globals.colors.backgroundAlt,
    borderRadius: 10,
    marginHorizontal: 18,
    marginTop: 8,
    paddingHorizontal: 14,
  },
  searchIcon: { width: 20, height: 20, resizeMode: 'contain', marginRight: 10 },
  searchInput: { flex: 1, fontSize: 14, color: globals.colors.text },

  filtersRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  chip: {
    flex: 1,
    height: 36,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: globals.colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { borderColor: globals.colors.primary, backgroundColor: globals.colors.surface },
  chipText: { fontSize: 12, fontWeight: '700', color: '#9D9D9D' },
  chipTextSelected: { color: globals.colors.primary },

  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    backgroundColor: globals.colors.surface,
    borderWidth: 1,
    borderColor: globals.colors.surfaceBorder,
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 12,
    ...globals.shadow.card,
  },
  exerciseImage: { width: 40, height: 40, borderRadius: 6 },
  exerciseImageEmpty: { backgroundColor: globals.colors.backgroundAlt },
  exerciseName: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: globals.colors.text, paddingHorizontal: 8 },
  addIcon: { width: 28, height: 28, resizeMode: 'contain' },

  customCard: {
    height: 56,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: globals.colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customCardText: { fontSize: 13, fontWeight: '600', color: globals.colors.primary },
  emptyText: { fontSize: 12, color: globals.colors.textSecondary, textAlign: 'center', marginBottom: 12 },

  footer: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 24, backgroundColor: globals.colors.surface },
  confirmButton: {
    backgroundColor: globals.colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    ...globals.shadow.button,
  },
  confirmButtonDisabled: { opacity: 0.5 },
  confirmButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
