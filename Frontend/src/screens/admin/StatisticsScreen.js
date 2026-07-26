// src/screens/admin/StatisticsScreen.js
//
// Statistics Screen (Admin) - spec section 16.
//
// Backend wiring:
//   GET /analytics/gym        -> { totalSessions, activeUsers }  (analytics.api.js)
//   GET /analytics/engagement -> { totalUsers, activeUsers, totalSessions,
//                                   totalPointsAwarded }          (analytics.api.js)
//
// Note: the Backend's getGymAnalytics() currently returns only totalSessions
// and activeUsers — it does not (yet) compute per-machine usage percentages
// or trainer average ratings described in the spec. Those sections are
// rendered as "not available yet" rather than invented client-side.

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import * as analyticsApi from '../../api/services/analytics.api';

/**
 * @param {function} [onBack]
 */
export default function StatisticsScreen({ onBack }) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [engagement, setEngagement] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [gymResult, engagementResult] = await Promise.allSettled([
      analyticsApi.getGymAnalytics(),
      analyticsApi.getEngagementMetrics(),
    ]);

    let anyFailed = false;
    if (gymResult.status === 'fulfilled') setStats(gymResult.value.data);
    else anyFailed = true;

    if (engagementResult.status === 'fulfilled') setEngagement(engagementResult.value.data);
    else anyFailed = true;

    if (anyFailed) setError(t('admin.statistics.loadError'));
    setLoading(false);
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {loading && <ActivityIndicator color={globals.colors.primary} style={styles.spinner} />}
      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('admin.statistics.overviewTitle')}</Text>
        {stats ? (
          <>
            <Text style={styles.statLine}>{t('admin.statistics.totalSessions', { count: stats.totalSessions })}</Text>
            <Text style={styles.statLine}>{t('admin.statistics.activeUsers', { count: stats.activeUsers })}</Text>
          </>
        ) : (
          !loading && <Text style={styles.mutedText}>{t('admin.statistics.overviewStatic')}</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('admin.statistics.trainersTitle')}</Text>
        <Text style={styles.mutedText}>{t('admin.statistics.notAvailable')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('admin.statistics.usersTitle')}</Text>
        <Text style={styles.mutedText}>{t('admin.statistics.notAvailable')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('admin.statistics.engagementTitle')}</Text>
        {engagement ? (
          <>
            <Text style={styles.statLine}>
              {t('admin.statistics.engagementTotalUsers', { count: engagement.totalUsers })}
            </Text>
            <Text style={styles.statLine}>
              {t('admin.statistics.engagementActiveUsers', { count: engagement.activeUsers })}
            </Text>
            <Text style={styles.statLine}>
              {t('admin.statistics.engagementTotalSessions', { count: engagement.totalSessions })}
            </Text>
            <Text style={styles.statLine}>
              {t('admin.statistics.engagementTotalPoints', { count: engagement.totalPointsAwarded })}
            </Text>
          </>
        ) : (
          !loading && <Text style={styles.mutedText}>{t('admin.statistics.notAvailable')}</Text>
        )}
      </View>

      <TouchableOpacity onPress={load} style={styles.refreshButton}>
        <Text style={styles.refreshButtonText}>{t('admin.statistics.refresh')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLink}>{t('admin.statistics.back')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: globals.colors.background },
  content: { padding: globals.spacing.md },
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
  statLine: {
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
    marginBottom: globals.spacing.xs,
  },
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
