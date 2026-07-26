// src/screens/user/AnalyticsScreen.js
//
// Personal Analytics Screen (User). Closes a gap flagged in the spec
// review: "Vistas de analíticas personales/patrones/engagement
// (/analytics/me, /analytics/patterns, /analytics/engagement)" had no
// screen wired up for the two member-facing ones.
//
// Backend wiring:
//   GET /analytics/me       -> session/minute totals + goal adherence
//                               (analytics.api.js)
//   GET /analytics/patterns -> frequent days/hour, top machines,
//                               consistency score (analytics.api.js)

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import * as analyticsApi from '../../api/services/analytics.api';

/**
 * @param {function} [onBack]
 */
export default function AnalyticsScreen({ onBack }) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [patterns, setPatterns] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [statsResult, patternsResult] = await Promise.allSettled([
      analyticsApi.getUserAnalytics(),
      analyticsApi.getUserPatterns(),
    ]);

    let anyFailed = false;
    if (statsResult.status === 'fulfilled') setStats(statsResult.value.data);
    else anyFailed = true;

    if (patternsResult.status === 'fulfilled') setPatterns(patternsResult.value.data);
    else anyFailed = true;

    if (anyFailed) setError(t('user.analytics.loadError'));
    setLoading(false);
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const machineEntries = stats?.machineUsage ? Object.entries(stats.machineUsage) : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('user.analytics.title')}</Text>

      {loading && <ActivityIndicator color={globals.colors.primary} style={styles.spinner} />}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {stats && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('user.analytics.summaryTitle')}</Text>
          <Text style={styles.statLine}>
            {t('user.analytics.totalSessions', { count: stats.total?.sessions ?? 0, minutes: stats.total?.minutes ?? 0 })}
          </Text>
          <Text style={styles.statLine}>
            {t('user.analytics.weeklySessions', { count: stats.weekly?.sessions ?? 0, minutes: stats.weekly?.minutes ?? 0 })}
          </Text>
          <Text style={styles.statLine}>
            {t('user.analytics.monthlySessions', { count: stats.monthly?.sessions ?? 0, minutes: stats.monthly?.minutes ?? 0 })}
          </Text>

          {stats.goalProgress ? (
            <Text style={[styles.statLine, stats.goalProgress.onTrack ? styles.onTrack : styles.offTrack]}>
              {t('user.analytics.goalProgress', {
                actual: stats.goalProgress.actualDaysThisWeek,
                target: stats.goalProgress.targetDaysPerWeek,
              })}
            </Text>
          ) : (
            <Text style={styles.mutedText}>{t('user.analytics.noGoal')}</Text>
          )}
        </View>
      )}

      {stats && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('user.analytics.machineUsageTitle')}</Text>
          {machineEntries.length === 0 ? (
            <Text style={styles.mutedText}>{t('user.analytics.machineUsageEmpty')}</Text>
          ) : (
            machineEntries.map(([name, count]) => (
              <Text key={name} style={styles.statLine}>
                {name} — {t('user.analytics.machineUsageCount', { count })}
              </Text>
            ))
          )}
        </View>
      )}

      {patterns && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('user.analytics.patternsTitle')}</Text>
          <Text style={styles.statLine}>
            {t('user.analytics.consistencyScore', { score: patterns.consistencyScore ?? 0 })}
          </Text>
          <Text style={styles.statLine}>
            {t('user.analytics.avgSessionsPerWeek', { count: patterns.avgSessionsPerWeek ?? 0 })}
          </Text>

          <Text style={styles.sectionLabel}>{t('user.analytics.frequentDaysTitle')}</Text>
          {(patterns.frequentDays ?? []).length === 0 ? (
            <Text style={styles.mutedText}>{t('user.analytics.noData')}</Text>
          ) : (
            patterns.frequentDays.slice(0, 3).map((d) => (
              <Text key={d.day} style={styles.statLine}>
                {d.name} — {t('user.analytics.dayShare', { percent: Math.round((d.share ?? 0) * 100) })}
              </Text>
            ))
          )}

          <Text style={styles.sectionLabel}>{t('user.analytics.topMachinesTitle')}</Text>
          {(patterns.topMachines ?? []).length === 0 ? (
            <Text style={styles.mutedText}>{t('user.analytics.noData')}</Text>
          ) : (
            patterns.topMachines.map((m) => (
              <Text key={m.name} style={styles.statLine}>
                {m.name} — {t('user.analytics.machineUsageCount', { count: m.count })}
              </Text>
            ))
          )}
        </View>
      )}

      <TouchableOpacity onPress={load} style={styles.refreshButton}>
        <Text style={styles.refreshButtonText}>{t('user.analytics.refresh')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLink}>{t('user.analytics.back')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: globals.colors.background },
  content: { padding: globals.spacing.md },
  title: {
    fontSize: globals.fontSize.lg,
    fontWeight: 'bold',
    color: globals.colors.text,
    marginBottom: globals.spacing.md,
  },
  spinner: { marginBottom: globals.spacing.md },
  card: {
    backgroundColor: globals.colors.sectionCard,
    borderRadius: globals.radius.md,
    padding: globals.spacing.md,
    marginBottom: globals.spacing.md,
  },
  cardTitle: {
    fontSize: globals.fontSize.md,
    fontWeight: '600',
    color: globals.colors.text,
    marginBottom: globals.spacing.sm,
  },
  sectionLabel: {
    fontSize: globals.fontSize.sm,
    fontWeight: '600',
    color: globals.colors.text,
    marginTop: globals.spacing.sm,
    marginBottom: globals.spacing.xs,
  },
  statLine: {
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
    marginBottom: globals.spacing.xs,
  },
  onTrack: { color: globals.colors.primary, fontWeight: '600' },
  offTrack: { color: globals.colors.danger, fontWeight: '600' },
  mutedText: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
  },
  errorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    marginBottom: globals.spacing.sm,
  },
  refreshButton: {
    borderWidth: 1,
    borderColor: globals.colors.primary,
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.sm,
    alignItems: 'center',
    marginBottom: globals.spacing.md,
  },
  refreshButtonText: { color: globals.colors.primary, fontWeight: '600' },
  backLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginVertical: globals.spacing.lg,
  },
});
