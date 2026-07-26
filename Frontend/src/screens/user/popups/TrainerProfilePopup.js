// src/screens/user/popups/TrainerProfilePopup.js
//
// Pop-up with a trainer's public profile, opened from the User Trainers
// screen. Closes a gap flagged in the spec review: "GET /trainers/:id"
// had no consumer anywhere in the frontend.
//
// Backend wiring:
//   GET /trainers/:id -> { firstName, lastName, trainerProfile:
//     { specialties, averageRating, totalRatings, availability } }
//     (user.api.js#getTrainerById)

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import globals from '../../../styles/globals';
import { useTranslation } from '../../../i18n/I18nContext';
import * as userApi from '../../../api/services/user.api';

/**
 * @param {string} [trainerId]
 * @param {function} [onClose]
 */
export default function TrainerProfilePopup({ trainerId, onClose }) {
  const { t } = useTranslation();

  const [trainer, setTrainer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!trainerId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    userApi
      .getTrainerById(trainerId)
      .then(({ data }) => {
        if (!cancelled) setTrainer(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || t('user.trainers.loadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [trainerId, t]);

  const specialties = trainer?.trainerProfile?.specialties ?? [];

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        {loading && <ActivityIndicator color={globals.colors.primary} />}
        {error && <Text style={styles.errorText}>{error}</Text>}

        {trainer && (
          <>
            <Text style={styles.name}>
              {`${trainer.firstName ?? ''} ${trainer.lastName ?? ''}`.trim() || trainer.id}
            </Text>

            <Text style={styles.sectionLabel}>{t('user.trainers.specialties')}</Text>
            <Text style={styles.bodyText}>
              {specialties.length > 0 ? specialties.join(', ') : t('user.trainers.none')}
            </Text>

            <Text style={styles.sectionLabel}>{t('user.trainers.rating')}</Text>
            <Text style={styles.bodyText}>
              {trainer.trainerProfile
                ? t('user.trainers.ratingValue', {
                    rating: (trainer.trainerProfile.averageRating ?? 0).toFixed(1),
                    count: trainer.trainerProfile.totalRatings ?? 0,
                  })
                : t('user.trainers.none')}
            </Text>

            <Text style={styles.sectionLabel}>{t('user.trainers.availability')}</Text>
            <Text style={styles.bodyText}>
              {trainer.trainerProfile?.availability === 'AVAILABLE'
                ? t('user.trainers.available')
                : t('user.trainers.busy')}
            </Text>
          </>
        )}

        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>{t('common.close')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: globals.spacing.md,
  },
  card: {
    backgroundColor: globals.colors.background,
    borderRadius: globals.radius.lg,
    padding: globals.spacing.md,
  },
  name: { fontSize: globals.fontSize.lg, fontWeight: 'bold', color: globals.colors.text },
  sectionLabel: {
    fontSize: globals.fontSize.sm,
    fontWeight: '600',
    color: globals.colors.text,
    marginTop: globals.spacing.md,
    marginBottom: globals.spacing.xs,
  },
  bodyText: { fontSize: globals.fontSize.md, color: globals.colors.text },
  errorText: { color: globals.colors.danger, fontSize: globals.fontSize.sm },
  closeButton: { marginTop: globals.spacing.lg, alignItems: 'center' },
  closeButtonText: { color: globals.colors.textMuted },
});
