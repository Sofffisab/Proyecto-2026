// src/screens/user/popups/RateTrainerPopup.js
//
// Rate Trainer(s) Pop-up - spec section 3.
// "Appears at the end of the day when the user leaves the gym, if they
// received help." / "Acción 2 (Si no ayudaron y sale igual): Marcar
// opción 'denunciar' y seleccionar la opción 'no me ayudaron'."
//
// Backed by POST /gym/sessions/:id/rate (gym.api.js#rateTrainer), which
// maps to gym.service.js#rateTrainer. That single endpoint already covers
// both flows from the spec: a normal 1-5 star rating, and — when
// helped=false — the Backend automatically files a complaint against the
// trainer alongside the rating, so this popup does not make a separate
// complaint call.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import globals from '../../../styles/globals';
import { useTranslation } from '../../../i18n/I18nContext';
import * as gymApi from '../../../api/services/gym.api';

const STARS = [1, 2, 3, 4, 5];

/**
 * @param {string} sessionId - The just-finished gym session to rate against.
 * @param {Array<{id: string, name: string}>} trainers - Trainers who helped
 *   during this session (resolved by the caller from the assistance/help
 *   history, e.g. Backend/src/controllers/history.controller.js interactions).
 * @param {function} [onRated] - Called with the API result after a
 *   successful submit (normal rating or "didn't help" report).
 * @param {function} [onClose] - Close button.
 */
export default function RateTrainerPopup({ sessionId, trainers = [], onRated, onClose }) {
  const { t } = useTranslation();

  const [selectedTrainerId, setSelectedTrainerId] = useState(trainers[0]?.id ?? null);
  const [rating, setRating] = useState(0);
  const [notHelped, setNotHelped] = useState(false);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(false);

    if (!sessionId || !selectedTrainerId) {
      setError(t('user.popups.rateTrainer.selectTrainer'));
      return;
    }
    if (!notHelped && rating === 0) {
      setError(t('user.popups.rateTrainer.selectRating'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await gymApi.rateTrainer(sessionId, {
        trainerId: selectedTrainerId,
        rating: notHelped ? 1 : rating,
        helped: !notHelped,
        comment: comment.trim() || undefined,
      });
      setSuccess(true);
      if (onRated) onRated(res.data);
    } catch (err) {
      setError(err.message || t('user.popups.rateTrainer.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>{t('user.popups.rateTrainer.title')}</Text>

        {trainers.length > 1 && (
          <View style={styles.trainerRow}>
            {trainers.map((trainer) => (
              <TouchableOpacity
                key={trainer.id}
                style={[styles.trainerChip, selectedTrainerId === trainer.id && styles.trainerChipSelected]}
                onPress={() => setSelectedTrainerId(trainer.id)}
              >
                <Text style={styles.trainerChipText}>{trainer.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!notHelped && (
          <View style={styles.starsRow}>
            {STARS.map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)}>
                <Text style={[styles.star, star <= rating && styles.starFilled]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.notHelpedRow}
          onPress={() => {
            setNotHelped((prev) => !prev);
            setRating(0);
          }}
        >
          <View style={[styles.checkbox, notHelped && styles.checkboxChecked]} />
          <Text style={styles.notHelpedText}>{t('user.popups.rateTrainer.markNotHelped')}</Text>
        </TouchableOpacity>

        {notHelped && (
          <TextInput
            style={styles.input}
            placeholder={t('user.popups.rateTrainer.commentPlaceholder')}
            value={comment}
            onChangeText={setComment}
            multiline
          />
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}
        {success && <Text style={styles.successText}>{t('user.popups.rateTrainer.success')}</Text>}

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color={globals.colors.secondary} />
          ) : (
            <Text style={styles.submitButtonText}>{t('user.popups.rateTrainer.submit')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeLink}>{t('user.popups.rateTrainer.close')}</Text>
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
    alignItems: 'center',
  },
  card: {
    width: '85%',
    backgroundColor: globals.colors.background,
    borderRadius: globals.radius.lg,
    padding: globals.spacing.lg,
  },
  title: {
    fontSize: globals.fontSize.lg,
    fontWeight: 'bold',
    color: globals.colors.text,
    marginBottom: globals.spacing.md,
    textAlign: 'center',
  },
  trainerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: globals.spacing.md,
  },
  trainerChip: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.xs,
    paddingHorizontal: globals.spacing.sm,
    marginRight: globals.spacing.sm,
    marginBottom: globals.spacing.sm,
  },
  trainerChipSelected: {
    backgroundColor: globals.colors.primary,
    borderColor: globals.colors.primary,
  },
  trainerChipText: {
    color: globals.colors.text,
    fontSize: globals.fontSize.sm,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: globals.spacing.md,
  },
  star: {
    fontSize: 32,
    color: globals.colors.border,
    marginHorizontal: globals.spacing.xs,
  },
  starFilled: {
    color: globals.colors.primary,
  },
  notHelpedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: globals.spacing.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.sm,
    marginRight: globals.spacing.sm,
  },
  checkboxChecked: {
    backgroundColor: globals.colors.danger,
    borderColor: globals.colors.danger,
  },
  notHelpedText: {
    color: globals.colors.text,
    fontSize: globals.fontSize.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    padding: globals.spacing.sm,
    minHeight: 60,
    textAlignVertical: 'top',
    color: globals.colors.text,
    marginBottom: globals.spacing.md,
  },
  errorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    marginBottom: globals.spacing.sm,
    textAlign: 'center',
  },
  successText: {
    color: globals.colors.primary,
    fontSize: globals.fontSize.sm,
    marginBottom: globals.spacing.sm,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.md,
    alignItems: 'center',
    marginBottom: globals.spacing.sm,
  },
  submitButtonText: {
    color: globals.colors.secondary,
    fontWeight: '600',
  },
  closeLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
  },
});
