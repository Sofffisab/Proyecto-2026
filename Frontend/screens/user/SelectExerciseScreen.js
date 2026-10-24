// src/screens/user/SelectExerciseScreen.js
//
// "Seleccionar ejercicio" (screen 4). Lists the exercises stored in the
// database (the gym's catalog plus the person's own ones); "+" toggles an
// exercise and "Agregar ejercicios" adds every toggled one to the day being
// edited (the draft in RoutinesContext). A card at the end of the list creates
// a new own exercise, which is saved to the database.

import React, { useEffect, useState } from 'react';
import { View, Text, Image, TextInput, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import Header from '../../components/common/Header';
import CustomExercisePopup from './popups/CustomExercisePopup';
import { useTranslation } from '../../i18n/I18nContext';
import { useRoutines } from '../../context/RoutinesContext';

const ALL_FILTER = 'all';

/**
 * @param {function} [onBack]
 * @param {function} [onDone] - Called after the selected exercises were added.
 */
export default function SelectExerciseScreen({ onBack, onDone }) {
  const { t } = useTranslation();
  const { draft, exercises, muscleGroups, catalogStatus, loadCatalog, addCustomExercise, addToDraft } = useRoutines();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(ALL_FILTER);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showCustomPopup, setShowCustomPopup] = useState(false);

  // Refresh the catalog from the database every time the selector opens.
  useEffect(() => {
    loadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "All" plus one chip per muscle group the database reports.
  const filterOptions = [
    { key: ALL_FILTER, label: t('user.routines.filters.all') },
    ...muscleGroups.map((key) => ({ key, label: t(`user.routines.muscles.${key}`) })),
  ];

  // Exercises already in the day are not offered again.
  const takenIds = (draft?.exercises ?? []).map((ex) => ex.id);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleExercises = exercises.filter((exercise) => {
    if (takenIds.includes(exercise.id)) return false;
    if (normalizedQuery && !exercise.name.toLowerCase().includes(normalizedQuery)) return false;
    if (filter === ALL_FILTER) return true;
    return exercise.muscles.includes(filter);
  });

  const toggleSelected = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleConfirm = () => {
    addToDraft(selectedIds);
    if (onDone) onDone();
  };

  // Saved to the database; it is created under the muscle filter in use.
  const handleCreateCustom = async ({ name, description, imageUri }) => {
    try {
      const created = await addCustomExercise({
        name,
        description,
        imageUri,
        muscles: filter === ALL_FILTER ? [] : [filter],
      });
      setSelectedIds((prev) => [...prev, created.id]);
      setShowCustomPopup(false);
    } catch {
      Alert.alert(t('user.routines.saveError'));
    }
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

      <View style={styles.filtersWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          {filterOptions.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.chip, filter === opt.key && styles.chipSelected]}
              onPress={() => setFilter(opt.key)}
            >
              <Text style={[styles.chipText, filter === opt.key && styles.chipTextSelected]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
        {catalogStatus.loading && exercises.length === 0 && (
          <ActivityIndicator color={globals.colors.primary} style={styles.loader} />
        )}
        {catalogStatus.error && exercises.length === 0 && (
          <TouchableOpacity onPress={loadCatalog}>
            <Text style={styles.emptyText}>{t('user.routines.loadError')} · {t('user.routines.retry')}</Text>
          </TouchableOpacity>
        )}
        {!catalogStatus.loading && !catalogStatus.error && visibleExercises.length === 0 && (
          <Text style={styles.emptyText}>{t('user.routines.noExercisesFound')}</Text>
        )}
        {visibleExercises.map((exercise) => {
          const selected = selectedIds.includes(exercise.id);
          const image = exercise.imageSource;
          return (
            <View key={exercise.id} style={styles.exerciseRow}>
              {image ? <Image source={image} style={styles.exerciseImage} /> : <View style={[styles.exerciseImage, styles.exerciseImageEmpty]} />}
              <Text style={styles.exerciseName} numberOfLines={2}>{exercise.name}</Text>
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

  loader: { marginVertical: 24 },
  filtersWrap: { height: 64 },
  filtersRow: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
  },
  chip: {
    minWidth: 78,
    paddingHorizontal: 14,
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
