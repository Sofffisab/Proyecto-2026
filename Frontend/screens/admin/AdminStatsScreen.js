// Admin "Estadísticas" — mockup "Pantalla estadísticas admin":
//  - General: machine usage percentages
//  - Trainers: average rating, among other data
//  - Users: deactivated / activated, met their goals or not
// All numbers come from GET /admin/stats (last 30 days for machine usage).

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import ScreenBody from '../../components/trainer/ScreenBody';
import Card from '../../components/admin/Card';
import SectionTitle from '../../components/admin/SectionTitle';
import { StarIcon } from '../../components/admin/AdminIcons';
import useLoad from '../../hooks/useLoad';
import * as adminApi from '../../apiClient/services/admin.api';
import StateView from '../../components/common/StateView';

const loadStats = async () => (await adminApi.getStats()).data;

function Tile({ value, label }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

export default function AdminStatsScreen() {
  const { t } = useTranslation();
  const { data: stats, loading, error, reload } = useLoad(loadStats);

  return (
    <ScreenBody title={t('admin.stats.title')} subtitle={t('admin.stats.subtitle')}>
      <StateView loading={loading} error={error} onRetry={reload}>
        {stats && <StatsBody stats={stats} />}
      </StateView>
    </ScreenBody>
  );
}

function StatsBody({ stats }) {
  const { t } = useTranslation();
  const { machineUsage, trainers, trainersAverage, users } = stats;

  return (
    <>
      {/* ---- General ---- */}
      <SectionTitle>{t('admin.stats.generalTitle')}</SectionTitle>
      <Card>
        <Text style={styles.cardTitle}>{t('admin.stats.machineUsage')}</Text>
        <Text style={styles.caption}>{t('admin.stats.machineUsageHint', { days: stats.windowDays, visits: stats.visits })}</Text>
        {machineUsage.length === 0 && <Text style={styles.caption}>{t('admin.stats.noMachines')}</Text>}
        {machineUsage.map((m) => (
          <View key={m.id} style={styles.barRow}>
            <View style={styles.barHead}>
              <Text style={styles.barName} numberOfLines={1}>{m.name}</Text>
              <Text style={styles.barPercent}>{m.percent}%</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${m.percent}%` }]} />
            </View>
          </View>
        ))}
      </Card>

      {/* ---- Trainers ---- */}
      <SectionTitle>{t('admin.stats.trainersTitle')}</SectionTitle>
      <Card>
        <View style={styles.avgRow}>
          <StarIcon color={globals.colors.primary} size={26} />
          <Text style={styles.avgValue}>{trainersAverage ?? '–'}</Text>
          <Text style={styles.avgLabel}>{t('admin.stats.avgRating')}</Text>
        </View>
        {trainers.length === 0 && <Text style={styles.caption}>{t('admin.stats.noTrainers')}</Text>}
        {trainers.map((tr) => (
          <View key={tr.id} style={styles.trainerRow}>
            <View style={styles.trainerTexts}>
              <Text style={styles.barName} numberOfLines={1}>{tr.name}</Text>
              <Text style={styles.caption}>{t('admin.stats.helps', { count: tr.helps })}</Text>
            </View>
            <StarIcon color={globals.colors.primary} size={16} />
            <Text style={styles.trainerRating}>{tr.rating ?? '–'}</Text>
          </View>
        ))}
      </Card>

      {/* ---- Users ---- */}
      <SectionTitle>{t('admin.stats.usersTitle')}</SectionTitle>
      <View style={styles.tiles}>
        <Tile value={users.activated} label={t('admin.stats.activated')} />
        <Tile value={users.deactivated} label={t('admin.stats.deactivated')} />
      </View>
      <View style={styles.tiles}>
        <Tile value={users.metGoals} label={t('admin.stats.metGoals')} />
        <Tile value={users.notMetGoals} label={t('admin.stats.notMetGoals')} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: globals.fontSize.md, fontWeight: '700', color: globals.colors.text },
  barRow: { marginTop: globals.spacing.md },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  barName: { flex: 1, fontSize: globals.fontSize.md, color: globals.colors.text },
  barPercent: { fontSize: globals.fontSize.md, fontWeight: '700', color: globals.colors.primary },
  track: { height: 8, borderRadius: 4, backgroundColor: globals.colors.surfaceBorder, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: globals.colors.primary },
  avgRow: { flexDirection: 'row', alignItems: 'center', gap: globals.spacing.sm },
  avgValue: { fontSize: globals.fontSize.xl, fontWeight: '700', color: globals.colors.text },
  avgLabel: { flex: 1, fontSize: globals.fontSize.sm, color: globals.colors.captionGrey },
  trainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: globals.spacing.md,
    paddingTop: globals.spacing.md,
    borderTopWidth: 1,
    borderTopColor: globals.colors.surfaceBorder,
  },
  trainerTexts: { flex: 1 },
  trainerRating: { fontSize: globals.fontSize.md, fontWeight: '700', color: globals.colors.text },
  caption: { marginTop: 2, fontSize: globals.fontSize.sm, color: globals.colors.captionGrey },
  tiles: { flexDirection: 'row', gap: globals.spacing.sm, marginBottom: globals.spacing.sm },
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
  tileValue: { fontSize: globals.fontSize.xl, fontWeight: '700', color: globals.colors.text },
  tileLabel: { marginTop: 2, fontSize: globals.fontSize.sm, color: globals.colors.captionGrey, textAlign: 'center' },
});
