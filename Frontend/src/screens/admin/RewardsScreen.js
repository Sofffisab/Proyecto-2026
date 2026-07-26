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
//   POST /rewards             -> create a new reward in the catalog        (rewardAdmin.api.js)
//   PATCH /rewards/:id        -> edit an existing reward (name, stock,
//                                 points cost, active, marketing flag)      (rewardAdmin.api.js)

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Switch } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import * as rewardAdminApi from '../../api/services/rewardAdmin.api';

const emptyForm = { name: '', description: '', pointsCost: '', stock: '', active: true, isMarketingItem: false };

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

  // Create/edit reward form. editingId === null means "creating new".
  const [editingId, setEditingId] = useState(undefined); // undefined = form hidden
  const [form, setForm] = useState(emptyForm);
  const [formSaving, setFormSaving] = useState(false);
  const [formMessage, setFormMessage] = useState(null);

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

  const openCreateForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormMessage(null);
  };

  const openEditForm = (reward) => {
    setEditingId(reward.id);
    setForm({
      name: reward.name ?? '',
      description: reward.description ?? '',
      pointsCost: String(reward.pointsCost ?? ''),
      stock: String(reward.stock ?? ''),
      active: reward.active ?? true,
      isMarketingItem: reward.isMarketingItem ?? false,
    });
    setFormMessage(null);
  };

  const closeForm = () => {
    setEditingId(undefined);
    setForm(emptyForm);
    setFormMessage(null);
  };

  const handleSaveReward = async () => {
    const pointsCost = parseInt(form.pointsCost, 10);
    if (!form.name.trim() || Number.isNaN(pointsCost) || pointsCost < 0) {
      setFormMessage({ type: 'error', text: t('admin.rewards.nameAndPointsRequired') });
      return;
    }
    const stock = form.stock.trim() === '' ? undefined : parseInt(form.stock, 10);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      pointsCost,
      stock,
      active: form.active,
      isMarketingItem: form.isMarketingItem,
    };

    setFormSaving(true);
    setFormMessage(null);
    try {
      if (editingId) {
        const { data } = await rewardAdminApi.updateReward(editingId, payload);
        setRewards((prev) => prev.map((r) => (r.id === editingId ? data : r)));
        setFormMessage({ type: 'success', text: t('admin.rewards.updateSuccess') });
      } else {
        const { data } = await rewardAdminApi.createReward(payload);
        setRewards((prev) => [...prev, data]);
        setFormMessage({ type: 'success', text: t('admin.rewards.createSuccess') });
      }
      closeForm();
    } catch (err) {
      setFormMessage({
        type: 'error',
        text: err.message || t(editingId ? 'admin.rewards.updateError' : 'admin.rewards.createError'),
      });
    } finally {
      setFormSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {loading && <ActivityIndicator color={globals.colors.primary} style={styles.spinner} />}
      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('admin.rewards.catalogTitle')}</Text>
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
              <TouchableOpacity style={styles.smallButton} onPress={() => openEditForm(r)}>
                <Text style={styles.smallButtonText}>{t('admin.rewards.edit')}</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        {editingId === undefined ? (
          <TouchableOpacity style={styles.button} onPress={openCreateForm}>
            <Text style={styles.buttonText}>{t('admin.rewards.createReward')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.formCard}>
            <Text style={styles.cardTitle}>
              {editingId ? t('admin.rewards.editReward') : t('admin.rewards.createReward')}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={t('admin.rewards.namePlaceholder')}
              placeholderTextColor={globals.colors.textMuted}
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              editable={!formSaving}
            />
            <TextInput
              style={styles.input}
              placeholder={t('admin.rewards.descriptionPlaceholder')}
              placeholderTextColor={globals.colors.textMuted}
              value={form.description}
              onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
              editable={!formSaving}
            />
            <TextInput
              style={styles.input}
              placeholder={t('admin.rewards.pointsCostPlaceholder')}
              placeholderTextColor={globals.colors.textMuted}
              value={form.pointsCost}
              onChangeText={(v) => setForm((f) => ({ ...f, pointsCost: v.replace(/[^0-9]/g, '') }))}
              keyboardType="numeric"
              editable={!formSaving}
            />
            <TextInput
              style={styles.input}
              placeholder={t('admin.rewards.stockPlaceholder')}
              placeholderTextColor={globals.colors.textMuted}
              value={form.stock}
              onChangeText={(v) => setForm((f) => ({ ...f, stock: v.replace(/[^0-9]/g, '') }))}
              keyboardType="numeric"
              editable={!formSaving}
            />
            <View style={styles.switchRow}>
              <Text style={styles.mutedText}>{t('admin.rewards.isActive')}</Text>
              <Switch
                value={form.active}
                onValueChange={(v) => setForm((f) => ({ ...f, active: v }))}
                disabled={formSaving}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.mutedText}>{t('admin.rewards.isMarketingItem')}</Text>
              <Switch
                value={form.isMarketingItem}
                onValueChange={(v) => setForm((f) => ({ ...f, isMarketingItem: v }))}
                disabled={formSaving}
              />
            </View>

            {formMessage && (
              <Text style={formMessage.type === 'error' ? styles.errorText : styles.successText}>
                {formMessage.text}
              </Text>
            )}

            <View style={styles.formActionsRow}>
              <TouchableOpacity style={[styles.button, styles.formButton]} onPress={handleSaveReward} disabled={formSaving}>
                {formSaving ? (
                  <ActivityIndicator color={globals.colors.background} />
                ) : (
                  <Text style={styles.buttonText}>{t('admin.rewards.save')}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={closeForm} disabled={formSaving}>
                <Text style={styles.mutedText}>{t('admin.rewards.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  successText: {
    color: globals.colors.primary,
    fontSize: globals.fontSize.sm,
    marginBottom: globals.spacing.sm,
  },
  button: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
    marginTop: globals.spacing.sm,
  },
  buttonText: {
    color: globals.colors.background,
    fontSize: globals.fontSize.md,
    fontWeight: '600',
  },
  formCard: {
    marginTop: globals.spacing.sm,
    paddingTop: globals.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: globals.colors.border,
    gap: globals.spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    paddingHorizontal: globals.spacing.md,
    paddingVertical: globals.spacing.sm,
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
    backgroundColor: globals.colors.background,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: globals.spacing.md,
  },
  formButton: { flex: 1 },
  cancelButton: { paddingVertical: globals.spacing.sm, paddingHorizontal: globals.spacing.sm },
  backLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginVertical: globals.spacing.lg,
  },
});
