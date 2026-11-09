// "Conflictos de máquina a verificar": two members scanned the same machine
// at (roughly) the same time and the trainer checks in person who is really
// there. The four buttons match the backend resolutions
// (machineConflict.api#resolveConflict): BOTH_PRESENT | ONLY_FIRST |
// ONLY_SECOND | NEITHER_PRESENT. Picking one marks the result of the check:
// whoever was not there has their machine usage closed by the Backend.
// Data: GET /qr/machine-conflicts, PATCH /qr/machine-conflicts/:id/resolve.

import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import ScreenBody from '../../components/trainer/ScreenBody';
import { AlertIcon } from '../../components/trainer/TrainerIcons';
import useLiveLoad from '../../hooks/useLiveLoad';
import { formatDateTime } from '../../utils/format';
import * as trainerApi from '../../apiClient/services/trainer.api';
import StateView from '../../components/common/StateView';

const loadConflicts = async () => (await trainerApi.getMachineConflicts()).data ?? [];
const fullName = (u) => `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || '–';

const RESOLUTIONS = [
  { key: 'bothPresent', value: 'BOTH_PRESENT', danger: false },
  { key: 'neitherPresent', value: 'NEITHER_PRESENT', danger: true },
  { key: 'onlyFirst', value: 'ONLY_FIRST', danger: false },
  { key: 'onlySecond', value: 'ONLY_SECOND', danger: false },
];

function ConflictCard({ conflict, busy, onResolve }) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.iconCircle}>
          <AlertIcon color={globals.colors.primary} size={22} />
        </View>
        <View style={styles.headTexts}>
          <Text style={styles.machine} numberOfLines={1}>{conflict.machine?.name}</Text>
          <Text style={styles.caption}>{t('trainer.machineConflicts.detectedAt', { date: formatDateTime(conflict.detectedAt) })}</Text>
        </View>
      </View>

      <View style={styles.users}>
        <Text style={styles.user}>{t('trainer.machineConflicts.firstUser', { name: fullName(conflict.firstUser) })}</Text>
        <Text style={styles.user}>{t('trainer.machineConflicts.secondUser', { name: fullName(conflict.secondUser) })}</Text>
      </View>

      <Text style={styles.question}>{t('trainer.machineConflicts.whoIsPresent')}</Text>
      <View style={styles.grid}>
        {RESOLUTIONS.map(({ key, value, danger }) => (
          <TouchableOpacity
            key={key}
            style={[styles.option, danger && styles.optionDanger, busy && styles.optionBusy]}
            onPress={() => onResolve(conflict.id, value)}
            disabled={busy}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Text style={[styles.optionLabel, danger && styles.optionDangerLabel]}>
              {t(`trainer.machineConflicts.${key}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function TrainerMachineConflictsScreen() {
  const { t } = useTranslation();
  const { data, loading, error, reload } = useLiveLoad(loadConflicts, ['conflicts']);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState(null); // { type, text }

  const resolve = useCallback(
    async (id, resolution) => {
      setBusyId(id);
      setMessage(null);
      try {
        await trainerApi.resolveMachineConflict(id, resolution);
        setMessage({ type: 'ok', text: t('trainer.machineConflicts.resolveSuccess') });
        await reload({ silent: true });
      } catch (err) {
        setMessage({ type: 'error', text: err.message || t('trainer.machineConflicts.resolveError') });
      } finally {
        setBusyId(null);
      }
    },
    [reload, t]
  );

  const conflicts = data ?? [];
  return (
    <ScreenBody title={t('trainer.machineConflicts.title')} subtitle={t('trainer.machineConflicts.subtitle')}>
      {!!message && <Text style={[styles.message, message.type === 'error' && styles.messageError]}>{message.text}</Text>}
      <StateView loading={loading} error={error} onRetry={reload} empty={conflicts.length === 0} emptyText={t('trainer.machineConflicts.empty')}>
        {conflicts.map((c) => (
          <ConflictCard key={c.id} conflict={c} busy={busyId === c.id} onResolve={resolve} />
        ))}
      </StateView>
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: globals.colors.surface,
    borderRadius: globals.radius.lg,
    borderWidth: 1,
    borderColor: globals.colors.surfaceBorder,
    padding: globals.spacing.md,
    marginBottom: globals.spacing.md,
    ...globals.shadow.card,
  },
  head: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: globals.colors.iconCircle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headTexts: { flex: 1, marginLeft: globals.spacing.md },
  machine: { fontSize: globals.fontSize.md, fontWeight: '700', color: globals.colors.text },
  caption: { marginTop: 2, fontSize: globals.fontSize.sm, color: globals.colors.captionGrey },
  users: {
    marginTop: globals.spacing.md,
    paddingTop: globals.spacing.md,
    borderTopWidth: 1,
    borderTopColor: globals.colors.surfaceBorder,
    gap: 4,
  },
  user: { fontSize: globals.fontSize.md, color: globals.colors.text },
  question: {
    marginTop: globals.spacing.md,
    fontSize: globals.fontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: globals.colors.accent,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: globals.spacing.sm, marginTop: globals.spacing.sm },
  option: {
    flexGrow: 1,
    flexBasis: '45%',
    alignItems: 'center',
    borderRadius: globals.radius.full,
    borderWidth: 1.5,
    borderColor: globals.colors.primary,
    paddingVertical: 11,
    paddingHorizontal: globals.spacing.sm,
  },
  optionLabel: { color: globals.colors.primary, fontWeight: '700', fontSize: globals.fontSize.sm + 1 },
  optionBusy: { opacity: 0.5 },
  message: { marginBottom: globals.spacing.md, color: globals.colors.primary, fontSize: globals.fontSize.md },
  messageError: { color: globals.colors.danger },
  optionDanger: { borderColor: globals.colors.danger },
  optionDangerLabel: { color: globals.colors.danger },
});
