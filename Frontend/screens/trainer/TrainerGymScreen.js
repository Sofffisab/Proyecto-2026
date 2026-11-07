// Trainer "Gym" tab (dumbbell): quick gym status + the trainer's
// availability switch. The notification bell lives in the header (shell).
// Static (see mockData.js). The switch maps to
// PATCH /assistance/trainer/availability (assistance.api#setTrainerAvailability).

import React, { useState } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import ScreenBody from '../../components/trainer/ScreenBody';
import { UsersIcon, DumbbellIcon, HandIcon } from '../../components/trainer/TrainerIcons';
import { GYM_STATUS } from './mockData';

function StatTile({ Icon, value, label }) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileIcon}>
        <Icon color={globals.colors.primary} size={22} />
      </View>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

export default function TrainerGymScreen() {
  const { t } = useTranslation();
  const [available, setAvailable] = useState(true);

  return (
    <ScreenBody title={t('trainer.gym.title')} subtitle={t('trainer.gym.subtitle')}>
      <View style={styles.tiles}>
        <StatTile Icon={UsersIcon} value={GYM_STATUS.peopleInGym} label={t('trainer.gym.peopleInGym')} />
        <StatTile
          Icon={DumbbellIcon}
          value={`${GYM_STATUS.machinesInUse}/${GYM_STATUS.machinesTotal}`}
          label={t('trainer.gym.machinesInUse')}
        />
        <StatTile Icon={HandIcon} value={GYM_STATUS.helpRequests} label={t('trainer.gym.helpRequests')} />
      </View>

      <View style={styles.card}>
        <View style={styles.cardTexts}>
          <Text style={styles.cardTitle}>{t('trainer.home.availabilityTitle')}</Text>
          <Text style={[styles.state, !available && styles.stateBusy]}>
            {available ? t('trainer.home.available') : t('trainer.home.busy')}
          </Text>
          <Text style={styles.hint}>{t('trainer.gym.availabilityHint')}</Text>
        </View>
        <Switch
          value={available}
          onValueChange={setAvailable}
          trackColor={{ false: globals.colors.secondary, true: globals.colors.primary }}
          thumbColor="#fff"
          accessibilityLabel={t('trainer.home.availabilityTitle')}
        />
      </View>
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: globals.spacing.sm, marginBottom: globals.spacing.md },
  tile: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: globals.colors.surface,
    borderRadius: globals.radius.lg,
    borderWidth: 1,
    borderColor: globals.colors.surfaceBorder,
    paddingVertical: globals.spacing.md,
    paddingHorizontal: globals.spacing.xs,
    ...globals.shadow.card,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: globals.colors.iconCircle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileValue: { marginTop: globals.spacing.sm, fontSize: globals.fontSize.xl, fontWeight: '700', color: globals.colors.text },
  tileLabel: { marginTop: 2, fontSize: globals.fontSize.sm, color: globals.colors.captionGrey, textAlign: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: globals.colors.surface,
    borderRadius: globals.radius.lg,
    borderWidth: 1,
    borderColor: globals.colors.surfaceBorder,
    padding: globals.spacing.md,
    ...globals.shadow.card,
  },
  cardTexts: { flex: 1, marginRight: globals.spacing.md },
  cardTitle: { fontSize: globals.fontSize.md, fontWeight: '700', color: globals.colors.text },
  state: { marginTop: 2, fontSize: globals.fontSize.md, fontWeight: '600', color: globals.colors.primary },
  stateBusy: { color: globals.colors.textSecondary },
  hint: { marginTop: 4, fontSize: globals.fontSize.sm, color: globals.colors.captionGrey, lineHeight: 17 },
});
