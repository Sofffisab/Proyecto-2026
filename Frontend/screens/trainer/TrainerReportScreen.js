// "Denunciar": pick WHO or WHAT to report (a trainer, a person in the gym or
// a machine), say why, and send it for the admin to review.
//  - trainer / person -> POST /complaints/trainer
//  - machine          -> POST /denuncias/machine
// Candidates: GET /trainers, GET /gym/people and GET /qr/gym-access.

import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import ScreenBody from '../../components/trainer/ScreenBody';
import { CheckIcon } from '../../components/trainer/TrainerIcons';
import { useAuth } from '../../context/AuthContext';
import useLoad from '../../hooks/useLoad';
import * as trainerApi from '../../apiClient/services/trainer.api';
import StateView from '../../components/common/StateView';

const fullName = (u) => `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || u?.email || '–';

async function loadCandidates() {
  const [trainers, people, machines] = await Promise.all([
    trainerApi.getTrainers(),
    trainerApi.getPeopleInGym(),
    trainerApi.getMachines(),
  ]);
  return {
    trainer: (trainers.data ?? []).map((u) => ({ id: u.id, name: fullName(u) })),
    member: (people.data ?? []).map((p) => ({ id: p.id, name: p.name })),
    machine: (machines.data ?? []).map((m) => ({ id: m.id, name: m.name })),
  };
}

const CATEGORIES = ['trainer', 'member', 'machine'];
// Reason chips -> the codes the Backend validates (progress.schemas.js).
// A machine has no reason categories: it is always "broken / damaged" plus the details.
const REASONS = [
  { key: 'reasonMachineDamage', code: 'MACHINE_DAMAGE' },
  { key: 'reasonMisconduct', code: 'MISCONDUCT' },
  { key: 'reasonFalseClaim', code: 'FALSE_CLAIM' },
  { key: 'reasonOther', code: 'OTHER' },
];

export default function TrainerReportScreen() {
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const { data: candidates, loading, error, reload } = useLoad(loadCandidates);
  const [category, setCategory] = useState('member');
  const [targetId, setTargetId] = useState(null);
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(null); // { type, text }

  // A trainer cannot report themselves.
  const options = ((candidates ?? {})[category] ?? []).filter((o) => !(category === 'trainer' && o.id === me?.id));
  const isMachine = category === 'machine';
  const canSend = !!targetId && (isMachine || !!reason) && !sending;

  const send = useCallback(async () => {
    setSending(true);
    setMessage(null);
    try {
      if (isMachine) {
        await trainerApi.reportMachine({ machineId: targetId, comment: details.trim() || undefined });
      } else {
        await trainerApi.reportPerson({
          reportedUserId: targetId,
          reason,
          message: details.trim() || undefined,
        });
      }
      setMessage({ type: 'ok', text: t('trainer.reports.sendSuccess') });
      setTargetId(null);
      setReason(null);
      setDetails('');
    } catch (err) {
      setMessage({ type: 'error', text: err.message || t('trainer.reports.sendError') });
    } finally {
      setSending(false);
    }
  }, [isMachine, targetId, reason, details, t]);

  return (
    <ScreenBody title={t('trainer.hub.reportTitle')} subtitle={t('trainer.reports.subtitle')}>
      {/* ---- Who / what ---- */}
      <Text style={styles.label}>{t('trainer.reports.target')}</Text>
      <View style={styles.segment}>
        {CATEGORIES.map((c) => {
          const on = c === category;
          return (
            <TouchableOpacity
              key={c}
              style={[styles.segmentItem, on && styles.segmentItemOn]}
              onPress={() => { setCategory(c); setTargetId(null); }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.segmentLabel, on && styles.segmentLabelOn]}>
                {t(`trainer.reports.category_${c}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <StateView loading={loading} error={error} onRetry={reload} empty={options.length === 0} emptyText={t(`trainer.reports.none_${category}`)}>
      <View style={styles.list}>
        {options.map((o, i) => {
          const on = o.id === targetId;
          return (
            <TouchableOpacity
              key={o.id}
              style={[styles.option, i < options.length - 1 && styles.optionDivider]}
              onPress={() => setTargetId(o.id)}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
            >
              <Text style={styles.optionLabel}>{o.name}</Text>
              <View style={[styles.radio, on && styles.radioOn]}>
                {on && <CheckIcon color="#fff" size={12} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      </StateView>

      {/* ---- Why ---- */}
      {!isMachine && <Text style={styles.label}>{t('trainer.reports.reason')}</Text>}
      {!isMachine && <View style={styles.chips}>
        {REASONS.map(({ key, code }) => {
          const on = code === reason;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => setReason(code)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{t(`trainer.reports.${key}`)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>}

      <TextInput
        style={styles.input}
        value={details}
        onChangeText={setDetails}
        placeholder={t('trainer.reports.messagePlaceholder')}
        placeholderTextColor={globals.colors.textMuted}
        multiline
        textAlignVertical="top"
      />

      {!!message && <Text style={[styles.message, message.type === 'error' && styles.messageError]}>{message.text}</Text>}

      <TouchableOpacity
        style={[styles.send, !canSend && styles.sendDisabled]}
        activeOpacity={0.85}
        disabled={!canSend}
        onPress={send}
        accessibilityRole="button"
      >
        <Text style={styles.sendLabel}>{sending ? t('trainer.reports.sending') : t('trainer.reports.send')}</Text>
      </TouchableOpacity>
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: globals.fontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: globals.colors.accent,
    marginBottom: globals.spacing.sm,
    marginTop: globals.spacing.xs,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: globals.colors.backgroundAlt,
    borderRadius: globals.radius.full,
    padding: 4,
    marginBottom: globals.spacing.md,
  },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: globals.radius.full },
  segmentItemOn: { backgroundColor: globals.colors.primary },
  segmentLabel: { fontSize: globals.fontSize.sm + 1, fontWeight: '600', color: globals.colors.navInactive },
  segmentLabelOn: { color: '#fff' },
  list: {
    backgroundColor: globals.colors.surface,
    borderRadius: globals.radius.lg,
    borderWidth: 1,
    borderColor: globals.colors.surfaceBorder,
    marginBottom: globals.spacing.lg,
    ...globals.shadow.card,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: globals.spacing.md,
  },
  optionDivider: { borderBottomWidth: 1, borderBottomColor: globals.colors.surfaceBorder },
  optionLabel: { fontSize: globals.fontSize.md, color: globals.colors.text },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: globals.colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: globals.colors.primary, borderColor: globals.colors.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: globals.spacing.sm, marginBottom: globals.spacing.md },
  chip: {
    borderRadius: globals.radius.full,
    borderWidth: 1.5,
    borderColor: globals.colors.goalBorder,
    backgroundColor: globals.colors.surface,
    paddingVertical: 8,
    paddingHorizontal: globals.spacing.md,
  },
  chipOn: { backgroundColor: globals.colors.primary, borderColor: globals.colors.primary },
  chipLabel: { fontSize: globals.fontSize.sm + 1, color: globals.colors.text, fontWeight: '600' },
  chipLabelOn: { color: '#fff' },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.lg,
    padding: globals.spacing.md,
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
    backgroundColor: globals.colors.surface,
  },
  send: {
    marginTop: globals.spacing.lg,
    alignItems: 'center',
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.full,
    paddingVertical: 14,
    ...globals.shadow.button,
  },
  sendDisabled: { opacity: 0.45 },
  message: { marginTop: globals.spacing.md, color: globals.colors.primary, fontSize: globals.fontSize.md },
  messageError: { color: globals.colors.danger },
  sendLabel: { color: '#fff', fontSize: globals.fontSize.md, fontWeight: '700' },
});
