// Admin "Premios":
//  - The prize being handed out now + how much is left of it
//  - Controls: pause/resume every delivery, add stock, edit a prize, create a
//    prize, choose which one is the current prize (each change is written to
//    the non-deletable history by the Backend)
//  - Shipments in progress (mark them delivered once the gift arrives)
//  - Waitlist: members who reached the points while nothing was available
// Data: GET /rewards/admin/overview (+ the actions in admin.api.js).

import React, { useCallback, useState } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import useLoad from '../../hooks/useLoad';
import { formatDate } from '../../utils/format';
import * as adminApi from '../../apiClient/services/admin.api';
import ScreenBody from '../../components/trainer/ScreenBody';
import Avatar from '../../components/trainer/Avatar';
import Card from '../../components/admin/Card';
import SectionTitle from '../../components/admin/SectionTitle';
import StatusPill from '../../components/admin/StatusPill';
import AdminButton from '../../components/admin/AdminButton';
import FormModal from '../../components/admin/FormModal';
import FormField from '../../components/admin/FormField';
import StateView from '../../components/common/StateView';
import { GiftIcon, ClockIcon } from '../../components/admin/AdminIcons';

const loadOverview = async () => (await adminApi.getPrizesOverview()).data;

const EMPTY_FORM = { name: '', description: '', pointsCost: '', stock: '', active: true };

export default function AdminPrizesScreen() {
  const { t } = useTranslation();
  const { data, loading, error, reload } = useLoad(loadOverview);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null); // { type: 'stock' | 'edit' | 'create', prize? }
  const [form, setForm] = useState(EMPTY_FORM);
  const [amount, setAmount] = useState('');
  const [modalError, setModalError] = useState(null);

  const run = useCallback(
    async (action) => {
      setBusy(true);
      setMessage(null);
      try {
        await action();
        await reload({ silent: true });
        return true;
      } catch (err) {
        setMessage(err.message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [reload]
  );

  const openStock = (prize) => {
    setAmount('');
    setModalError(null);
    setModal({ type: 'stock', prize });
  };
  const openEdit = (prize) => {
    setForm({ name: prize.name, description: prize.description, pointsCost: String(prize.pointsCost), stock: '', active: prize.active });
    setModalError(null);
    setModal({ type: 'edit', prize });
  };
  const openCreate = () => {
    setForm(EMPTY_FORM);
    setModalError(null);
    setModal({ type: 'create' });
  };

  const submitModal = async () => {
    setModalError(null);
    const toInt = (v) => (/^\d+$/.test(String(v).trim()) ? parseInt(v, 10) : NaN);

    if (modal.type === 'stock') {
      const n = toInt(amount);
      if (!(n >= 1)) return setModalError(t('admin.prizes.invalidAmount'));
      const ok = await run(() => adminApi.addPrizeStock(modal.prize.id, n));
      if (ok) setModal(null);
      return;
    }

    const cost = toInt(form.pointsCost);
    if (!form.name.trim()) return setModalError(t('admin.prizes.nameRequired'));
    if (Number.isNaN(cost)) return setModalError(t('admin.prizes.invalidCost'));

    if (modal.type === 'edit') {
      const ok = await run(() =>
        adminApi.updatePrize(modal.prize.id, {
          name: form.name.trim(),
          description: form.description.trim(),
          pointsCost: cost,
          active: form.active,
        })
      );
      if (ok) setModal(null);
      return;
    }

    const stock = form.stock.trim() === '' ? 0 : toInt(form.stock);
    if (Number.isNaN(stock)) return setModalError(t('admin.prizes.invalidAmount'));
    const ok = await run(() =>
      adminApi.createPrize({ name: form.name.trim(), description: form.description.trim(), pointsCost: cost, stock, active: true })
    );
    if (ok) setModal(null);
  };

  const rewards = data?.rewards ?? [];
  const current = rewards.find((p) => p.isCurrent);
  const delivering = data ? !data.deliveriesPaused : true;

  return (
    <ScreenBody title={t('admin.prizes.title')} subtitle={t('admin.prizes.subtitle')}>
      <StateView loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            {!!message && <Text style={styles.error}>{message}</Text>}

            {/* ---- Current prize + delivery switch ---- */}
            <Card>
              <Text style={styles.caption}>{t('admin.prizes.currentLabel')}</Text>
              {current ? (
                <>
                  <Text style={styles.currentName}>{current.name}</Text>
                  <Text style={styles.currentStock}>{t('admin.prizes.left', { count: current.stock, total: current.total })}</Text>
                </>
              ) : (
                <Text style={styles.currentStock}>{t('admin.prizes.noCurrent')}</Text>
              )}
              <View style={styles.switchRow}>
                <View style={styles.switchTexts}>
                  <Text style={styles.switchTitle}>{t('admin.prizes.deliveryLabel')}</Text>
                  <Text style={[styles.switchState, !delivering && styles.switchStatePaused]}>
                    {delivering ? t('admin.prizes.deliveryActive') : t('admin.prizes.deliveryPaused')}
                  </Text>
                </View>
                <Switch
                  value={delivering}
                  disabled={busy}
                  onValueChange={(on) => run(() => adminApi.setDeliveriesPaused(!on))}
                  trackColor={{ false: globals.colors.secondary, true: globals.colors.primary }}
                  thumbColor="#fff"
                  accessibilityLabel={t('admin.prizes.deliveryLabel')}
                />
              </View>
              <Text style={styles.note}>{t('admin.prizes.historyNote')}</Text>
            </Card>

            {/* ---- Stock per prize ---- */}
            <SectionTitle>{t('admin.prizes.stockTitle')}</SectionTitle>
            <AdminButton label={t('admin.prizes.newPrize')} onPress={openCreate} style={styles.newBtn} />
            {rewards.length === 0 && <Text style={styles.empty}>{t('admin.prizes.noPrizes')}</Text>}
            {rewards.map((p) => {
              const pct = p.total ? Math.min(100, Math.round((p.stock / p.total) * 100)) : 0;
              return (
                <Card key={p.id}>
                  <View style={styles.head}>
                    <View style={styles.iconCircle}>
                      <GiftIcon color={globals.colors.primary} size={22} />
                    </View>
                    <View style={styles.headTexts}>
                      <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                      <Text style={styles.caption}>{t('admin.prizes.left', { count: p.stock, total: p.total })}</Text>
                      <Text style={styles.caption}>{t('admin.prizes.cost', { points: p.pointsCost })}</Text>
                    </View>
                    <View style={styles.pills}>
                      {p.isCurrent && <StatusPill label={t('admin.prizes.currentPill')} />}
                      {!p.active && <StatusPill label={t('admin.prizes.inactive')} tone="grey" />}
                      {p.stock === 0 && <StatusPill label={t('admin.prizes.outOfStock')} tone="danger" />}
                    </View>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${pct}%` }, p.stock === 0 && styles.fillEmpty]} />
                  </View>
                  <View style={styles.actions}>
                    <AdminButton label={t('admin.prizes.addStock')} variant="primary" onPress={() => openStock(p)} disabled={busy} style={styles.action} />
                    <AdminButton label={t('admin.prizes.edit')} onPress={() => openEdit(p)} disabled={busy} style={styles.action} />
                  </View>
                  {!p.isCurrent && p.active && (
                    <AdminButton
                      label={t('admin.prizes.makeCurrent')}
                      onPress={() => run(() => adminApi.setCurrentPrize(p.id))}
                      disabled={busy}
                      style={styles.fullBtn}
                    />
                  )}
                </Card>
              );
            })}

            {/* ---- Shipments in progress ---- */}
            <SectionTitle>{t('admin.prizes.shipmentsTitle')}</SectionTitle>
            <Text style={styles.sectionHint}>{t('admin.prizes.shipmentsHint')}</Text>
            {data.shipments.length === 0 && <Text style={styles.empty}>{t('admin.prizes.noShipments')}</Text>}
            {data.shipments.map((s) => (
              <Card key={s.id}>
                <View style={styles.rowCard}>
                  <Avatar name={s.user} size={44} />
                  <View style={styles.headTexts}>
                    <Text style={styles.name} numberOfLines={1}>{s.user}</Text>
                    <Text style={styles.caption}>{t('admin.prizes.shipmentRow', { prize: s.prize, date: formatDate(s.shippedAt) })}</Text>
                  </View>
                </View>
                <AdminButton
                  label={t('admin.prizes.markDelivered')}
                  variant="primary"
                  onPress={() => run(() => adminApi.markDelivered(s.id))}
                  disabled={busy}
                  style={styles.fullBtn}
                />
              </Card>
            ))}

            {/* ---- Waitlist ---- */}
            <SectionTitle>{t('admin.prizes.waitlistTitle')}</SectionTitle>
            <Text style={styles.sectionHint}>{t('admin.prizes.waitlistHint')}</Text>
            {data.waitlist.length === 0 && <Text style={styles.empty}>{t('admin.prizes.noWaitlist')}</Text>}
            {data.waitlist.map((w) => (
              <Card key={w.id} style={styles.rowCard}>
                <View style={styles.iconCircle}>
                  <ClockIcon color={globals.colors.primary} size={22} />
                </View>
                <View style={styles.headTexts}>
                  <Text style={styles.name} numberOfLines={1}>{w.user}</Text>
                  <Text style={styles.caption}>{t('admin.prizes.waitingRow', { points: w.points, date: formatDate(w.since) })}</Text>
                </View>
              </Card>
            ))}
          </>
        )}
      </StateView>

      {/* ---- Add stock ---- */}
      <FormModal
        visible={modal?.type === 'stock'}
        title={t('admin.prizes.addStockTitle', { prize: modal?.prize?.name ?? '' })}
        onClose={() => setModal(null)}
        onSubmit={submitModal}
        submitLabel={t('admin.prizes.addStock')}
        busy={busy}
        error={modalError}
      >
        <FormField label={t('admin.prizes.amountLabel')} value={amount} onChangeText={setAmount} keyboardType="number-pad" />
      </FormModal>

      {/* ---- Edit / create prize ---- */}
      <FormModal
        visible={modal?.type === 'edit' || modal?.type === 'create'}
        title={modal?.type === 'create' ? t('admin.prizes.newPrize') : t('admin.prizes.editTitle')}
        onClose={() => setModal(null)}
        onSubmit={submitModal}
        busy={busy}
        error={modalError}
      >
        <FormField label={t('admin.prizes.nameLabel')} value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} autoCapitalize="sentences" />
        <FormField label={t('admin.prizes.descriptionLabel')} value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} multiline autoCapitalize="sentences" />
        <FormField label={t('admin.prizes.costLabel')} value={form.pointsCost} onChangeText={(v) => setForm((f) => ({ ...f, pointsCost: v }))} keyboardType="number-pad" />
        {modal?.type === 'create' && (
          <FormField label={t('admin.prizes.initialStockLabel')} value={form.stock} onChangeText={(v) => setForm((f) => ({ ...f, stock: v }))} keyboardType="number-pad" />
        )}
        {modal?.type === 'edit' && (
          <View style={styles.switchRow}>
            <Text style={[styles.switchTitle, styles.switchTexts]}>{t('admin.prizes.activeLabel')}</Text>
            <Switch
              value={form.active}
              onValueChange={(v) => setForm((f) => ({ ...f, active: v }))}
              trackColor={{ false: globals.colors.secondary, true: globals.colors.primary }}
              thumbColor="#fff"
            />
          </View>
        )}
      </FormModal>
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: globals.fontSize.sm, color: globals.colors.captionGrey },
  error: { color: globals.colors.danger, marginBottom: globals.spacing.md },
  empty: { color: globals.colors.textSecondary, marginBottom: globals.spacing.md },
  currentName: { marginTop: 2, fontSize: globals.fontSize.lg, fontWeight: '700', color: globals.colors.text },
  currentStock: { marginTop: 2, fontSize: globals.fontSize.md, color: globals.colors.text },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: globals.spacing.md,
    paddingTop: globals.spacing.md,
    borderTopWidth: 1,
    borderTopColor: globals.colors.surfaceBorder,
  },
  switchTexts: { flex: 1 },
  switchTitle: { fontSize: globals.fontSize.md, fontWeight: '700', color: globals.colors.text },
  switchState: { marginTop: 2, fontSize: globals.fontSize.md, fontWeight: '600', color: globals.colors.primary },
  switchStatePaused: { color: globals.colors.textSecondary },
  note: { marginTop: globals.spacing.sm, fontSize: globals.fontSize.sm, color: globals.colors.captionGrey, lineHeight: 17 },
  head: { flexDirection: 'row', alignItems: 'center' },
  headTexts: { flex: 1, marginHorizontal: globals.spacing.md },
  pills: { gap: 4, alignItems: 'flex-end' },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: globals.colors.iconCircle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: globals.fontSize.md, fontWeight: '700', color: globals.colors.text },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: globals.colors.surfaceBorder,
    marginTop: globals.spacing.md,
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: 3, backgroundColor: globals.colors.primary },
  fillEmpty: { backgroundColor: globals.colors.danger },
  actions: { flexDirection: 'row', gap: globals.spacing.sm, marginTop: globals.spacing.md },
  action: { flex: 1 },
  fullBtn: { marginTop: globals.spacing.sm },
  newBtn: { marginBottom: globals.spacing.md },
  sectionHint: { marginTop: -globals.spacing.xs, marginBottom: globals.spacing.sm, fontSize: globals.fontSize.sm, color: globals.colors.captionGrey, lineHeight: 17 },
  rowCard: { flexDirection: 'row', alignItems: 'center' },
});
