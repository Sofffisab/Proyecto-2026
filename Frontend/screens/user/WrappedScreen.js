// src/screens/user/WrappedScreen.js
//
// Year Wrapped Screen (User - Eventually) - spec section 8:
// "Muestra estadísticas de su situación puntual de forma gráfica (estilo
// Spotify), calculado en la app automáticamente y usando su historial
// entre otros datos."
//
// Backed by GET /analytics/wrapped?year=YYYY (gamification.api.js#getWrapped),
// which maps to Backend/src/services/wrapped.service.js#generateWrapped.
// That endpoint computes totals on the fly from sessions/machine
// usage/points/assistances/social interactions for the given year and
// upserts a snapshot — so this screen just displays whatever it returns.
// A simple year switcher lets the user flip between the current and
// previous year (the "eventually"/1-month-access gating mentioned in the
// spec is a display-availability concern, not a data one, so it's left
// for the navigation layer).

import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import * as gamificationApi from '../../api/services/gamification.api';

const CURRENT_YEAR = new Date().getFullYear();

function StatCard({ label, value }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/**
 * @param {function} [onBack]
 */
export default function WrappedScreen({ onBack }) {
  const { t } = useTranslation();

  const [year, setYear] = useState(CURRENT_YEAR);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stats, setStats] = useState(null);

  const load = useCallback(async (targetYear) => {
    setLoading(true);
    setError(false);
    try {
      const res = await gamificationApi.getWrapped(targetYear);
      setStats(res.data ?? null);
    } catch {
      setError(true);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(year);
    }, [load, year])
  );

  const goPreviousYear = () => setYear((y) => y - 1);
  const goNextYear = () => setYear((y) => Math.min(CURRENT_YEAR, y + 1));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('user.wrapped.title')}</Text>

      <View style={styles.yearSwitcher}>
        <TouchableOpacity onPress={goPreviousYear}>
          <Text style={styles.yearArrow}>{`< ${t('user.wrapped.previousYear')}`}</Text>
        </TouchableOpacity>
        <Text style={styles.yearLabel}>{t('user.wrapped.subtitle', { year })}</Text>
        <TouchableOpacity onPress={goNextYear} disabled={year >= CURRENT_YEAR}>
          <Text style={[styles.yearArrow, year >= CURRENT_YEAR && styles.yearArrowDisabled]}>
            {`${t('user.wrapped.nextYear')} >`}
          </Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={globals.colors.primary} />
          <Text style={styles.loadingText}>{t('user.wrapped.loading')}</Text>
        </View>
      )}

      {!loading && error && <Text style={styles.errorText}>{t('user.wrapped.loadError')}</Text>}

      {!loading && !error && stats && (
        <>
          <View style={styles.statsGrid}>
            <StatCard label={t('user.wrapped.totalSessions')} value={stats.totalSessions ?? 0} />
            <StatCard label={t('user.wrapped.totalMinutes')} value={stats.totalMinutes ?? 0} />
            <StatCard label={t('user.wrapped.totalPoints')} value={stats.totalPoints ?? 0} />
            <StatCard label={t('user.wrapped.assistancesReceived')} value={stats.assistancesReceived ?? 0} />
            <StatCard label={t('user.wrapped.peopleMetCount')} value={stats.peopleMetCount ?? 0} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('user.wrapped.topMachinesTitle')}</Text>
            {(stats.machines ?? []).length === 0 ? (
              <Text style={styles.emptyText}>{t('user.wrapped.topMachinesEmpty')}</Text>
            ) : (
              stats.machines.map((m, idx) => (
                <View key={`${m.name}-${idx}`} style={styles.row}>
                  <Text style={styles.rowPrimary}>{idx + 1}. {m.name}</Text>
                  <Text style={styles.rowSecondary}>{m.count}</Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('user.wrapped.topTrainersTitle')}</Text>
            {(stats.topTrainers ?? []).length === 0 ? (
              <Text style={styles.emptyText}>{t('user.wrapped.topTrainersEmpty')}</Text>
            ) : (
              stats.topTrainers.map((tr, idx) => (
                <View key={tr.trainerId ?? idx} style={styles.row}>
                  <Text style={styles.rowPrimary}>{idx + 1}. {tr.name}</Text>
                  <Text style={styles.rowSecondary}>{tr.count}</Text>
                </View>
              ))
            )}
          </View>
        </>
      )}

      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLink}>{t('user.wrapped.back')}</Text>
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
    fontSize: globals.fontSize.xl,
    fontWeight: 'bold',
    color: globals.colors.primary,
    textAlign: 'center',
    marginBottom: globals.spacing.md,
  },
  yearSwitcher: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: globals.spacing.lg,
  },
  yearArrow: {
    color: globals.colors.primary,
    fontSize: globals.fontSize.sm,
    fontWeight: '600',
  },
  yearArrowDisabled: {
    color: globals.colors.textMuted,
  },
  yearLabel: {
    fontSize: globals.fontSize.md,
    fontWeight: '600',
    color: globals.colors.text,
  },
  loadingBox: {
    alignItems: 'center',
    marginTop: globals.spacing.xl,
  },
  loadingText: {
    marginTop: globals.spacing.sm,
    color: globals.colors.textMuted,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: globals.spacing.lg,
  },
  statCard: {
    width: '48%',
    backgroundColor: globals.colors.sectionCard,
    borderRadius: globals.radius.lg,
    paddingVertical: globals.spacing.lg,
    alignItems: 'center',
    marginBottom: globals.spacing.sm,
  },
  statValue: {
    fontSize: globals.fontSize.xxl,
    fontWeight: 'bold',
    color: globals.colors.primary,
  },
  statLabel: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    marginTop: globals.spacing.xs,
    textAlign: 'center',
  },
  section: {
    marginBottom: globals.spacing.lg,
  },
  sectionTitle: {
    fontSize: globals.fontSize.md,
    fontWeight: '600',
    color: globals.colors.text,
    marginBottom: globals.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    padding: globals.spacing.md,
    marginBottom: globals.spacing.sm,
  },
  rowPrimary: {
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
  },
  rowSecondary: {
    fontSize: globals.fontSize.md,
    color: globals.colors.primary,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
  },
  errorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    textAlign: 'center',
    marginTop: globals.spacing.lg,
  },
  backLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginVertical: globals.spacing.lg,
  },
});
