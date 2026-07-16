// src/screens/admin/StatisticsScreen.js
//
// Statistics Screen (Admin) - spec section 16.
// "Generales del gym" (machine usage %), "Entrenadores" (average rating),
// "Usuarios" (deactivated/activated, goal completion). Backed by
// GET /analytics/gym, see Backend/src/services/insights.service.js#getGymAnalytics.

import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import * as analyticsApi from '../../api/services/analytics.api';

/**
 * @param {function} [onBack]
 */
export default function StatisticsScreen({ onBack }) {
  const { t } = useTranslation();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hadError, setHadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setHadError(false);
    try {
      const res = await analyticsApi.getGymAnalytics();
      setStats(res.data);
    } catch {
      setHadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {loading && (
        <View style={styles.centerRow}>
          <ActivityIndicator color={globals.colors.primary} />
        </View>
      )}

      {!loading && hadError && <Text style={styles.errorText}>{t('admin.statistics.loadError')}</Text>}

      {!loading && !hadError && stats && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.statistics.overviewTitle')}</Text>
            {(stats.machineUsagePercentages ?? []).length === 0 ? (
              <Text style={styles.emptyText}>{t('admin.statistics.usageEmpty')}</Text>
            ) : (
              stats.machineUsagePercentages.map((m) => (
                <Text key={m.machineId} style={styles.rowText}>
                  {t('admin.statistics.machineUsageLabel', {
                    name: m.machineName,
                    percentage: m.percentage.toFixed(1),
                    count: m.usageCount,
                  })}
                </Text>
              ))
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.statistics.trainersTitle')}</Text>
            <Text style={styles.rowText}>
              {t('admin.statistics.trainerCountLabel', { count: stats.trainerCount ?? 0 })}
            </Text>
            {stats.averageTrainerRating > 0 ? (
              <Text style={styles.rowText}>
                {t('admin.statistics.averageRatingLabel', { rating: stats.averageTrainerRating.toFixed(2) })}
              </Text>
            ) : (
              <Text style={styles.emptyText}>{t('admin.statistics.noRatings')}</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.statistics.usersTitle')}</Text>
            <Text style={styles.rowText}>
              {t('admin.statistics.activeUsersLabel', { count: stats.activeUsers ?? 0 })}
            </Text>
            <Text style={styles.rowText}>
              {t('admin.statistics.inactiveUsersLabel', { count: stats.inactiveUsers ?? 0 })}
            </Text>
            <Text style={styles.rowText}>
              {t('admin.statistics.goalsMetLabel', { count: stats.goalsMet ?? 0 })}
            </Text>
            <Text style={styles.rowText}>
              {t('admin.statistics.goalsNotMetLabel', { count: stats.goalsNotMet ?? 0 })}
            </Text>
          </View>
        </>
      )}

      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLink}>{t('admin.statistics.back')}</Text>
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
  centerRow: {
    alignItems: 'center',
    marginVertical: globals.spacing.lg,
  },
  errorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    marginBottom: globals.spacing.md,
    textAlign: 'center',
  },
  section: {
    backgroundColor: globals.colors.sectionCard,
    borderRadius: globals.radius.lg,
    padding: globals.spacing.md,
    marginBottom: globals.spacing.md,
  },
  sectionTitle: {
    fontSize: globals.fontSize.md,
    fontWeight: '700',
    color: globals.colors.text,
    marginBottom: globals.spacing.sm,
  },
  rowText: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.text,
    marginBottom: globals.spacing.xs,
  },
  emptyText: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
  },
  backLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginVertical: globals.spacing.lg,
  },
});
