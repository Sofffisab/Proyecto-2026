// src/screens/user/ReportsScreen.js
//
// Reports Screen (User) - spec section 3 ("pop up de Denuncias"):
// "Selector de objetivo de denuncia: Lista de entrenadores, personas que
// figuran en el gym o elementos de la app (puntos, logros, etc.)."
// Previously implemented as a pop-up; converted to a full screen for
// consistency with the Trainer's Reports Screen (section 11) and because
// a report has real consequences (progressive penalties, alerts to Admin),
// which warrants the space and intent of a dedicated screen instead of a modal.
//
// Backend wiring:
//   - GET /trainers            -> trainer candidates      (user.api.js)
//   - GET /gym/occupancy/live  -> people currently present (gym.api.js)
//   - "App element" targets (points/achievements) don't have a
//     reportedUserId, so they route to the review-request flow instead:
//     POST /gamification/review-request                    (gamification.api.js)
//   - Person targets (trainer/member) route to:
//     POST /complaints -> { reportedUserId, reason }        (complaint.api.js)

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import * as userApi from '../../api/services/user.api';
import * as gymApi from '../../api/services/gym.api';
import * as complaintApi from '../../api/services/complaint.api';
import * as gamificationApi from '../../api/services/gamification.api';

const CATEGORY = {
  TRAINER: 'TRAINER',
  MEMBER: 'MEMBER',
  APP: 'APP',
};

const APP_ELEMENTS = [
  { id: 'points', labelKey: 'user.achievementsGoals.pointsTitle' },
  { id: 'achievements', labelKey: 'user.achievementsGoals.achievementsTitle' },
];

/**
 * @param {function} [onSubmit] - Called after a successful send.
 * @param {function} [onBack] - Back button.
 */
export default function ReportsScreen({ onSubmit, onBack }) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [hadLoadError, setHadLoadError] = useState(false);
  const [trainers, setTrainers] = useState([]);
  const [members, setMembers] = useState([]);

  const [category, setCategory] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null); // { id, label } or app element
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const loadTargets = useCallback(async () => {
    setLoading(true);
    const [trainersResult, membersResult] = await Promise.allSettled([
      userApi.getTrainers(),
      gymApi.getPresentUsers(),
    ]);

    let anyFailed = false;

    if (trainersResult.status === 'fulfilled') {
      setTrainers(trainersResult.value.data ?? []);
    } else {
      anyFailed = true;
    }

    if (membersResult.status === 'fulfilled') {
      setMembers(membersResult.value.data ?? []);
    } else {
      anyFailed = true;
    }

    setHadLoadError(anyFailed);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTargets();
  }, [loadTargets]);

  const selectCategory = (cat) => {
    setCategory(cat);
    setSelectedTarget(null);
    setError(null);
    setSuccess(false);
  };

  const handleSend = async () => {
    setSuccess(false);

    if (!category || !selectedTarget) {
      setError(t('user.reports.targetRequired'));
      return;
    }
    if (!reason.trim()) {
      setError(t('user.reports.reasonRequired'));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (category === CATEGORY.APP) {
        await gamificationApi.createReviewRequest(reason.trim());
      } else {
        await complaintApi.createComplaint({
          reportedUserId: selectedTarget.id,
          reason: reason.trim(),
        });
      }
      setSuccess(true);
      setReason('');
      setSelectedTarget(null);
      setCategory(null);
      if (onSubmit) onSubmit();
    } catch (err) {
      setError(err.message || t('user.reports.sendError'));
    } finally {
      setSubmitting(false);
    }
  };

  const renderTargetList = () => {
    if (!category) return null;

    if (category === CATEGORY.APP) {
      return APP_ELEMENTS.map((el) => (
        <TouchableOpacity
          key={el.id}
          style={[styles.targetRow, selectedTarget?.id === el.id && styles.targetRowSelected]}
          onPress={() => setSelectedTarget(el)}
        >
          <Text style={styles.targetRowText}>{t(el.labelKey)}</Text>
        </TouchableOpacity>
      ));
    }

    const list = category === CATEGORY.TRAINER ? trainers : members;
    const emptyLabel = category === CATEGORY.TRAINER ? t('user.reports.noTrainers') : t('user.reports.noMembers');

    if (loading) return <ActivityIndicator color={globals.colors.primary} />;
    if (list.length === 0) return <Text style={styles.emptyText}>{emptyLabel}</Text>;

    return list.map((person) => (
      <TouchableOpacity
        key={person.id}
        style={[styles.targetRow, selectedTarget?.id === person.id && styles.targetRowSelected]}
        onPress={() => setSelectedTarget({ id: person.id, label: `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() })}
      >
        <Text style={styles.targetRowText}>{`${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || person.id}</Text>
      </TouchableOpacity>
    ));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('user.reports.target')}</Text>

      {hadLoadError && <Text style={styles.errorText}>{t('user.reports.loadError')}</Text>}

      <View style={styles.categoryRow}>
        <TouchableOpacity
          style={[styles.categoryButton, category === CATEGORY.TRAINER && styles.categoryButtonSelected]}
          onPress={() => selectCategory(CATEGORY.TRAINER)}
        >
          <Text style={styles.categoryButtonText}>{t('user.reports.categoryTrainer')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.categoryButton, category === CATEGORY.MEMBER && styles.categoryButtonSelected]}
          onPress={() => selectCategory(CATEGORY.MEMBER)}
        >
          <Text style={styles.categoryButtonText}>{t('user.reports.categoryMember')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.categoryButton, category === CATEGORY.APP && styles.categoryButtonSelected]}
          onPress={() => selectCategory(CATEGORY.APP)}
        >
          <Text style={styles.categoryButtonText}>{t('user.reports.categoryApp')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>{t('user.reports.selectTarget')}</Text>
      <View style={styles.targetList}>{renderTargetList()}</View>

      <Text style={styles.sectionLabel}>{t('user.reports.reason')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('user.reports.reasonPlaceholder')}
        value={reason}
        onChangeText={setReason}
        multiline
      />

      {error && <Text style={styles.errorText}>{error}</Text>}
      {success && <Text style={styles.successText}>{t('user.reports.sendSuccess')}</Text>}

      <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color={globals.colors.secondary} />
        ) : (
          <Text style={styles.sendButtonText}>{t('user.reports.send')}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLink}>{t('user.reports.back')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: globals.colors.background,
  },
  content: {
    padding: globals.spacing.md,
  },
  title: {
    fontSize: globals.fontSize.lg,
    fontWeight: 'bold',
    color: globals.colors.text,
    marginBottom: globals.spacing.md,
  },
  sectionLabel: {
    fontSize: globals.fontSize.md,
    fontWeight: '600',
    color: globals.colors.text,
    marginTop: globals.spacing.md,
    marginBottom: globals.spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: globals.spacing.sm,
  },
  categoryButton: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.sm,
    paddingHorizontal: globals.spacing.md,
    marginRight: globals.spacing.sm,
    marginBottom: globals.spacing.sm,
  },
  categoryButtonSelected: {
    backgroundColor: globals.colors.primary,
    borderColor: globals.colors.primary,
  },
  categoryButtonText: {
    color: globals.colors.text,
    fontSize: globals.fontSize.sm,
  },
  targetList: {
    marginBottom: globals.spacing.sm,
  },
  targetRow: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    padding: globals.spacing.md,
    marginBottom: globals.spacing.sm,
  },
  targetRowSelected: {
    borderColor: globals.colors.primary,
    backgroundColor: globals.colors.sectionCard,
  },
  targetRowText: {
    color: globals.colors.text,
    fontSize: globals.fontSize.md,
  },
  emptyText: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
  },
  input: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    padding: globals.spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
    color: globals.colors.text,
  },
  errorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    marginTop: globals.spacing.sm,
  },
  successText: {
    color: globals.colors.primary,
    fontSize: globals.fontSize.sm,
    marginTop: globals.spacing.sm,
  },
  sendButton: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.md,
    alignItems: 'center',
    marginTop: globals.spacing.md,
  },
  sendButtonText: {
    color: globals.colors.secondary,
    fontWeight: '600',
    fontSize: globals.fontSize.md,
  },
  backLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginVertical: globals.spacing.lg,
  },
});
