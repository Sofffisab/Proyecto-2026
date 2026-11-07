// "Denunciar": pick WHO or WHAT to report (a trainer, a person in the gym or
// a machine), say why, and send. Selections are local state only — the send
// button does nothing yet (it will map to the denuncia/complaint endpoints:
// POST /complaints/trainer, see complaint.api).

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import ScreenBody from '../../components/trainer/ScreenBody';
import { CheckIcon } from '../../components/trainer/TrainerIcons';
import { PEOPLE_IN_GYM, REPORT_TRAINERS, REPORT_MACHINES } from './mockData';

const CATEGORIES = ['trainer', 'member', 'machine'];
const REASONS = ['reasonMachineDamage', 'reasonMisconduct', 'reasonFalseClaim', 'reasonOther'];

export default function TrainerReportScreen() {
  const { t } = useTranslation();
  const [category, setCategory] = useState('member');
  const [targetId, setTargetId] = useState(null);
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState('');

  const options = {
    trainer: REPORT_TRAINERS,
    member: PEOPLE_IN_GYM.map(({ id, name }) => ({ id, name })),
    machine: REPORT_MACHINES,
  }[category];

  const canSend = !!targetId && !!reason;

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

      {/* ---- Why ---- */}
      <Text style={styles.label}>{t('trainer.reports.reason')}</Text>
      <View style={styles.chips}>
        {REASONS.map((r) => {
          const on = r === reason;
          return (
            <TouchableOpacity
              key={r}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => setReason(r)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{t(`trainer.reports.${r}`)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TextInput
        style={styles.input}
        value={details}
        onChangeText={setDetails}
        placeholder={t('trainer.reports.messagePlaceholder')}
        placeholderTextColor={globals.colors.textMuted}
        multiline
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[styles.send, !canSend && styles.sendDisabled]}
        activeOpacity={0.85}
        disabled={!canSend}
        accessibilityRole="button"
      >
        <Text style={styles.sendLabel}>{t('trainer.reports.send')}</Text>
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
  sendLabel: { color: '#fff', fontSize: globals.fontSize.md, fontWeight: '700' },
});
