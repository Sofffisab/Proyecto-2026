// src/screens/trainer/ReportsScreen.js
//
// Reports Screen (Trainer) - spec section 11:
// "Selector de persona a denunciar: Lista de entrenadores y personas que
// figuran en el gym."
//
// Backend wiring:
//   - GET /trainers            -> trainer candidates      (user.api.js)
//   - GET /gym/occupancy/live  -> people currently present (gym.api.js)
//   - POST /complaints/trainer -> { reportedUserId, reason (fixed code),
//     message? } (complaint.api.js#createTrainerComplaint), validated
//     against Backend/src/validators/progress.schemas.js#createTrainerComplaintSchema.
//     Unlike the member-facing Reports screen, the trainer's "reason" is a
//     fixed category (machine damage / misconduct / rule violation /
//     other), not free text — the free-text field maps to `message`.

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import * as userApi from '../../api/services/user.api';
import * as gymApi from '../../api/services/gym.api';
import * as complaintApi from '../../api/services/complaint.api';

const CATEGORY = { TRAINER: 'TRAINER', MEMBER: 'MEMBER' };

const REASON_CODES = [
  { code: 'MACHINE_DAMAGE', labelKey: 'trainer.reports.reasonMachineDamage' },
  { code: 'MISCONDUCT', labelKey: 'trainer.reports.reasonMisconduct' },
  { code: 'RULE_VIOLATION', labelKey: 'trainer.reports.reasonRuleViolation' },
  { code: 'OTHER', labelKey: 'trainer.reports.reasonOther' },
];

/**
 * @param {function} [onSubmit]
 * @param {function} [onBack]
 */
export default function TrainerReportsScreen({ onSubmit, onBack }) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [hadLoadError, setHadLoadError] = useState(false);
  const [trainers, setTrainers] = useState([]);
  const [members, setMembers] = useState([]);

  const [category, setCategory] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [reasonCode, setReasonCode] = useState(null);
  const [message, setMessage] = useState('');
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
    if (trainersResult.status === 'fulfilled') setTrainers(trainersResult.value.data ?? []);
    else anyFailed = true;

    if (membersResult.status === 'fulfilled') setMembers(membersResult.value.data ?? []);
    else anyFailed = true;

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

    if (!selectedTarget) {
      setError(t('trainer.reports.targetRequired'));
      return;
    }
    if (!reasonCode) {
      setError(t('trainer.reports.reasonRequired'));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await complaintApi.createTrainerComplaint({
        reportedUserId: selectedTarget.id,
        reason: reasonCode,
        message: message.trim() || undefined,
      });
      setSuccess(true);
      setSelectedTarget(null);
      setCategory(null);
      setReasonCode(null);
      setMessage('');
      if (onSubmit) onSubmit();
    } catch (err) {
      setError(err.message || t('trainer.reports.sendError'));
    } finally {
      setSubmitting(false);
    }
  };

  const renderTargetList = () => {
    if (!category) return null;
    const list = category === CATEGORY.TRAINER ? trainers : members;
    const emptyLabel = category === CATEGORY.TRAINER ? t('trainer.reports.noTrainers') : t('trainer.reports.noMembers');

    if (loading) return <ActivityIndicator color={globals.colors.primary} />;
    if (list.length === 0) return <Text style={styles.emptyText}>{emptyLabel}</Text>;

    return list.map((person) => (
      <TouchableOpacity
        key={person.id}
        style={[styles.targetRow, selectedTarget?.id === person.id && styles.targetRowSelected]}
        onPress={() => setSelectedTarget({ id: person.id })}
      >
        <Text style={styles.targetRowText}>{`${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || person.id}</Text>
      </TouchableOpacity>
    ));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('trainer.reports.personToReport')}</Text>

      {hadLoadError && <Text style={styles.errorText}>{t('trainer.reports.loadError')}</Text>}

      <View style={styles.categoryRow}>
        <TouchableOpacity
          style={[styles.categoryButton, category === CATEGORY.TRAINER && styles.categoryButtonSelected]}
          onPress={() => selectCategory(CATEGORY.TRAINER)}
        >
          <Text style={styles.categoryButtonText}>{t('trainer.reports.categoryTrainer')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.categoryButton, category === CATEGORY.MEMBER && styles.categoryButtonSelected]}
          onPress={() => selectCategory(CATEGORY.MEMBER)}
        >
          <Text style={styles.categoryButtonText}>{t('trainer.reports.categoryMember')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>{t('trainer.reports.selectPerson')}</Text>
      <View style={styles.targetList}>{renderTargetList()}</View>

      <Text style={styles.sectionLabel}>{t('trainer.reports.reasonCodeLabel')}</Text>
      <View style={styles.categoryRow}>
        {REASON_CODES.map((r) => (
          <TouchableOpacity
            key={r.code}
            style={[styles.categoryButton, reasonCode === r.code && styles.categoryButtonSelected]}
            onPress={() => setReasonCode(r.code)}
          >
            <Text style={styles.categoryButtonText}>{t(r.labelKey)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>{t('trainer.reports.reason')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('trainer.reports.messagePlaceholder')}
        value={message}
        onChangeText={setMessage}
        multiline
      />

      {error && <Text style={styles.errorText}>{error}</Text>}
      {success && <Text style={styles.successText}>{t('trainer.reports.sendSuccess')}</Text>}

      <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color={globals.colors.secondary} />
        ) : (
          <Text style={styles.sendButtonText}>{t('trainer.reports.send')}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLink}>{t('trainer.reports.back')}</Text>
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
