// "Conflictos de máquina a verificar": two members scanned the same machine
// at (roughly) the same time and the trainer checks in person who is really
// there. The four buttons match the backend resolutions
// (machineConflict.api#resolveConflict): BOTH_PRESENT | ONLY_FIRST |
// ONLY_SECOND | NEITHER_PRESENT. Static (see mockData.js).

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import ScreenBody from '../../components/trainer/ScreenBody';
import { AlertIcon } from '../../components/trainer/TrainerIcons';
import { MACHINE_CONFLICTS } from './mockData';

const RESOLUTIONS = [
  { key: 'bothPresent', danger: false },
  { key: 'neitherPresent', danger: true },
  { key: 'onlyFirst', danger: false },
  { key: 'onlySecond', danger: false },
];

function ConflictCard({ conflict }) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.iconCircle}>
          <AlertIcon color={globals.colors.primary} size={22} />
        </View>
        <View style={styles.headTexts}>
          <Text style={styles.machine} numberOfLines={1}>{conflict.machine}</Text>
          <Text style={styles.caption}>{t('trainer.machineConflicts.detectedAt', { date: conflict.detectedAt })}</Text>
        </View>
      </View>

      <View style={styles.users}>
        <Text style={styles.user}>{t('trainer.machineConflicts.firstUser', { name: conflict.first })}</Text>
        <Text style={styles.user}>{t('trainer.machineConflicts.secondUser', { name: conflict.second })}</Text>
      </View>

      <Text style={styles.question}>{t('trainer.machineConflicts.whoIsPresent')}</Text>
      <View style={styles.grid}>
        {RESOLUTIONS.map(({ key, danger }) => (
          <TouchableOpacity
            key={key}
            style={[styles.option, danger && styles.optionDanger]}
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
  return (
    <ScreenBody title={t('trainer.machineConflicts.title')} subtitle={t('trainer.machineConflicts.subtitle')}>
      {MACHINE_CONFLICTS.map((c) => (
        <ConflictCard key={c.id} conflict={c} />
      ))}
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
  optionDanger: { borderColor: globals.colors.danger },
  optionDangerLabel: { color: globals.colors.danger },
});
