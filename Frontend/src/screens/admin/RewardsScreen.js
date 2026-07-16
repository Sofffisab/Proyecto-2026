// src/screens/admin/RewardsScreen.js
//
// Rewards Screen (Admin) - spec section 17.
//
// Backend wiring:
//   GET /rewards/admin        -> full catalog incl. stock       (rewardAdmin.api.js)
//   GET /rewards/redemptions  -> every auto-grant, filtered client-side
//                                 into SHIPPED ("in progress")   (rewardAdmin.api.js)
//   GET /rewards/pending      -> waitlist due to no stock/points (rewardAdmin.api.js)
//   PATCH /rewards/redemptions/:id -> mark a SHIPPED grant DELIVERED

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import * as rewardAdminApi from '../../api/services/rewardAdmin.api';

/**
 * @param {function} [onBack]
 */
export default function RewardsScreen({ onBack }) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [rewardsResult, redemptionsResult, pendingResult] = await Promise.allSettled([
      rewardAdminApi.getAllRewardsAdmin(),
      rewardAdminApi.getAllRedemptions(),
      rewardAdminApi.getPendingGrants(),
    ]);

    let anyFailed = false;

    if (rewardsResult.status === 'fulfilled') {
      setRewards(rewardsResult.value.data ?? []);
    } else anyFailed = true;

    if (redemptionsResult.status === 'fulfilled') {
      const all = redemptionsResult.value.data ?? [];
      setShipments(all.filter((r) => r.status === 'SHIPPED'));
    } else anyFailed = true;

    if (pendingResult.status === 'fulfilled') {
      setWaitlist(pendingResult.value.data ?? []);
    } else anyFailed = true;

    setError(anyFailed ? t('admin.rewards.loadError') : null);
    setLoading(false);
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const personName = (user) => `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.email || '—';

  const handleDelivered = async (redemptionId) => {
    setBusyId(redemptionId);
    try {
      await rewardAdminApi.markRedemptionDelivered(redemptionId);
      setShipments((prev) => prev.filter((r) => r.id !== redemptionId));
    } catch (err) {
      setError(err.message || t('admin.rewards.actionError'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {loading && <ActivityIndicator color={globals.colors.primary} style={styles.spinner} />}
      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('admin.rewards.stockStatusTitle')}</Text>
        {rewards.length === 0 && !loading ? (
          <Text style={styles.mutedText}>{t('admin.rewards.noRewards')}</Text>
        ) : (
          rewards.map((r) => (
            <View key={r.id} style={styles.row}>
              <Text style={styles.rowTitle}>{r.name}</Text>
              <Text style={styles.mutedText}>
                {t('admin.rewards.stockCount', { count: r.stock })} · {r.pointsCost} pts
                {r.isMarketingItem ? ` · ${t('admin.rewards.marketing')}` : ''}
                {!r.active ? ` · ${t('admin.rewards.inactive')}` : ''}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('admin.rewards.shipmentsInProgressTitle')}</Text>
        {shipments.length === 0 && !loading ? (
          <Text style={styles.mutedText}>{t('admin.rewards.noShipments')}</Text>
        ) : (
          shipments.map((s) => (
            <View key={s.id} style={styles.row}>
              <Text style={styles.rowTitle}>{personName(s.user)} — {s.reward?.name}</Text>
              <TouchableOpacity
                style={styles.smallButton}
                onPress={() => handleDelivered(s.id)}
                disabled={busyId === s.id}
              >
                {busyId === s.id ? (
                  <ActivityIndicator color={globals.colors.secondary} size="small" />
                ) : (
                  <Text style={styles.smallButtonText}>{t('admin.rewards.markDelivered')}</Text>
                )}
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('admin.rewards.waitlistTitle')}</Text>
        {waitlist.length === 0 && !loading ? (
          <Text style={styles.mutedText}>{t('admin.rewards.noWaitlist')}</Text>
        ) : (
          waitlist.map((w) => (
            <Text key={w.id} style={styles.row}>{personName(w.user)}</Text>
          ))
        )}
      </View>

      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLink}>{t('admin.rewards.back')}</Text>
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
  row: {
    paddingVertical: globals.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: globals.colors.border,
  },
  rowTitle: { fontSize: globals.fontSize.md, color: globals.colors.text },
  mutedText: { fontSize: globals.fontSize.sm, color: globals.colors.textMuted },
  errorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    marginBottom: globals.spacing.sm,
  },
  smallButton: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.sm,
    paddingVertical: globals.spacing.xs,
    paddingHorizontal: globals.spacing.sm,
    alignSelf: 'flex-start',
    marginTop: globals.spacing.xs,
  },
  smallButtonText: { color: globals.colors.secondary, fontSize: globals.fontSize.sm, fontWeight: '600' },
  backLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginVertical: globals.spacing.lg,
  },
});
