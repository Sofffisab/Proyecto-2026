// src/screens/user/TrainersScreen.js
//
// Trainers Screen (User). Lists the gym's trainers and, on tap, opens
// their public profile. Closes a gap flagged in the spec review:
// "GET /trainers/:id" had no consumer anywhere in the frontend.
//
// Backend wiring:
//   GET /trainers -> list of active trainers (user.api.js)
//   GET /trainers/:id -> public profile, fetched by TrainerProfilePopup
//                         when a row is tapped (user.api.js)

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import * as userApi from '../../api/services/user.api';
import TrainerProfilePopup from './popups/TrainerProfilePopup';

/**
 * @param {function} [onBack]
 */
export default function TrainersScreen({ onBack }) {
  const { t } = useTranslation();

  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTrainerId, setSelectedTrainerId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await userApi.getTrainers();
      setTrainers(data ?? []);
    } catch (err) {
      setError(err.message || t('user.trainers.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('user.trainers.title')}</Text>

      {loading && <ActivityIndicator color={globals.colors.primary} style={styles.spinner} />}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {!loading && trainers.length === 0 && (
        <Text style={styles.mutedText}>{t('user.trainers.empty')}</Text>
      )}

      {trainers.map((trainer) => (
        <TouchableOpacity
          key={trainer.id}
          style={styles.row}
          onPress={() => setSelectedTrainerId(trainer.id)}
        >
          <View style={styles.avatarPlaceholder} />
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>
              {`${trainer.firstName ?? ''} ${trainer.lastName ?? ''}`.trim() || trainer.id}
            </Text>
            <Text style={styles.mutedText}>
              {(trainer.trainerProfile?.specialties ?? []).join(', ') || t('user.trainers.none')}
            </Text>
          </View>
        </TouchableOpacity>
      ))}

      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLink}>{t('user.trainers.back')}</Text>
      </TouchableOpacity>

      <Modal
        visible={Boolean(selectedTrainerId)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedTrainerId(null)}
      >
        <TrainerProfilePopup trainerId={selectedTrainerId} onClose={() => setSelectedTrainerId(null)} />
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: globals.colors.background },
  content: { padding: globals.spacing.md },
  title: {
    fontSize: globals.fontSize.lg,
    fontWeight: 'bold',
    color: globals.colors.text,
    marginBottom: globals.spacing.md,
  },
  spinner: { marginBottom: globals.spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: globals.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: globals.colors.border,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: globals.radius.full,
    backgroundColor: globals.colors.avatarPlaceholder,
    marginRight: globals.spacing.sm,
  },
  rowInfo: { flex: 1, gap: 2 },
  rowTitle: { fontSize: globals.fontSize.md, color: globals.colors.text },
  mutedText: { fontSize: globals.fontSize.sm, color: globals.colors.textMuted },
  errorText: { color: globals.colors.danger, fontSize: globals.fontSize.sm, marginBottom: globals.spacing.sm },
  backLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginVertical: globals.spacing.lg,
  },
});
