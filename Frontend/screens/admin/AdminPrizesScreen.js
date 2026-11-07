// Admin "Premios" — mockup "Pantalla premios admin".
//  - Stock status (which prize is being handed out now + how much is left)
//  - Admin controls: pause/resume deliveries, add stock, edit a prize
//    (everything the admin does is logged in the non-deletable history)
//  - Shipments in progress (removed once the gift arrives)
//  - Waitlist for out-of-stock prizes
// Static (see mockData.js); the only live control is the visual switch.

import React, { useState } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import ScreenBody from '../../components/trainer/ScreenBody';
import Avatar from '../../components/trainer/Avatar';
import Card from '../../components/admin/Card';
import SectionTitle from '../../components/admin/SectionTitle';
import StatusPill from '../../components/admin/StatusPill';
import AdminButton from '../../components/admin/AdminButton';
import { GiftIcon, ClockIcon } from '../../components/admin/AdminIcons';
import { PRIZES, SHIPMENTS, WAITLIST } from './mockData';

export default function AdminPrizesScreen() {
  const { t } = useTranslation();
  const [delivering, setDelivering] = useState(true);
  const current = PRIZES.find((p) => p.current);

  return (
    <ScreenBody title={t('admin.prizes.title')} subtitle={t('admin.prizes.subtitle')}>
      {/* ---- Current prize + delivery switch ---- */}
      <Card>
        <Text style={styles.caption}>{t('admin.prizes.currentLabel')}</Text>
        <Text style={styles.currentName}>{current.name}</Text>
        <Text style={styles.currentStock}>{t('admin.prizes.left', { count: current.stock, total: current.total })}</Text>
        <View style={styles.switchRow}>
          <View style={styles.switchTexts}>
            <Text style={styles.switchTitle}>{t('admin.prizes.deliveryLabel')}</Text>
            <Text style={[styles.switchState, !delivering && styles.switchStatePaused]}>
              {delivering ? t('admin.prizes.deliveryActive') : t('admin.prizes.deliveryPaused')}
            </Text>
          </View>
          <Switch
            value={delivering}
            onValueChange={setDelivering}
            trackColor={{ false: globals.colors.secondary, true: globals.colors.primary }}
            thumbColor="#fff"
            accessibilityLabel={t('admin.prizes.deliveryLabel')}
          />
        </View>
        <Text style={styles.note}>{t('admin.prizes.historyNote')}</Text>
      </Card>

      {/* ---- Stock per prize ---- */}
      <SectionTitle>{t('admin.prizes.stockTitle')}</SectionTitle>
      {PRIZES.map((p) => {
        const pct = p.total ? Math.round((p.stock / p.total) * 100) : 0;
        return (
          <Card key={p.id}>
            <View style={styles.head}>
              <View style={styles.iconCircle}>
                <GiftIcon color={globals.colors.primary} size={22} />
              </View>
              <View style={styles.headTexts}>
                <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.caption}>{t('admin.prizes.left', { count: p.stock, total: p.total })}</Text>
              </View>
              {p.stock === 0 && <StatusPill label={t('admin.prizes.outOfStock')} tone="danger" />}
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct}%` }, p.stock === 0 && styles.fillEmpty]} />
            </View>
            <View style={styles.actions}>
              <AdminButton label={t('admin.prizes.addStock')} variant="primary" style={styles.action} />
              <AdminButton label={t('admin.prizes.edit')} style={styles.action} />
            </View>
          </Card>
        );
      })}

      {/* ---- Shipments in progress ---- */}
      <SectionTitle>{t('admin.prizes.shipmentsTitle')}</SectionTitle>
      <Text style={styles.sectionHint}>{t('admin.prizes.shipmentsHint')}</Text>
      {SHIPMENTS.map((s) => (
        <Card key={s.id} style={styles.rowCard}>
          <Avatar name={s.name} size={44} />
          <View style={styles.headTexts}>
            <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
            <Text style={styles.caption}>{t('admin.prizes.shipmentRow', { prize: s.prize, date: s.date })}</Text>
          </View>
        </Card>
      ))}

      {/* ---- Waitlist ---- */}
      <SectionTitle>{t('admin.prizes.waitlistTitle')}</SectionTitle>
      <Text style={styles.sectionHint}>{t('admin.prizes.waitlistHint')}</Text>
      {WAITLIST.map((w) => (
        <Card key={w.id} style={styles.rowCard}>
          <View style={styles.iconCircle}>
            <ClockIcon color={globals.colors.primary} size={22} />
          </View>
          <View style={styles.headTexts}>
            <Text style={styles.name} numberOfLines={1}>{w.prize}</Text>
            <Text style={styles.caption}>{t('admin.prizes.waiting', { count: w.count })}</Text>
          </View>
        </Card>
      ))}
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: globals.fontSize.sm, color: globals.colors.captionGrey },
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
  sectionHint: { marginTop: -globals.spacing.xs, marginBottom: globals.spacing.sm, fontSize: globals.fontSize.sm, color: globals.colors.captionGrey, lineHeight: 17 },
  rowCard: { flexDirection: 'row', alignItems: 'center' },
});
