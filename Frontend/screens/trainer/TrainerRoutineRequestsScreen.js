// "Solicitudes de armado de rutina": members asking the trainer to build
// them a routine. Static (see mockData.js). Accept / Reject map to
// PATCH /routines/requests/:id/accept | reject (routine.api).

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import ScreenBody from '../../components/trainer/ScreenBody';
import Avatar from '../../components/trainer/Avatar';
import { ROUTINE_REQUESTS } from './mockData';

function RequestCard({ request }) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Avatar name={request.name} size={44} />
        <View style={styles.headTexts}>
          <Text style={styles.name} numberOfLines={1}>{request.name}</Text>
          <Text style={styles.caption}>{t('trainer.routineRequests.requestedOn', { date: request.date })}</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>{t('trainer.routineRequests.statusPending')}</Text>
        </View>
      </View>

      <View style={styles.details}>
        <Text style={styles.detail}>{t('trainer.routineRequests.goalLabel', { goal: request.goal })}</Text>
        <Text style={styles.detail}>{t('trainer.routineRequests.levelLabel', { level: request.level })}</Text>
        <Text style={styles.detail}>{t('trainer.routineRequests.daysLabel', { days: request.days })}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, styles.btnOutline]} activeOpacity={0.8} accessibilityRole="button">
          <Text style={styles.btnOutlineLabel}>{t('trainer.routineRequests.reject')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} activeOpacity={0.8} accessibilityRole="button">
          <Text style={styles.btnPrimaryLabel}>{t('trainer.routineRequests.accept')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function TrainerRoutineRequestsScreen() {
  const { t } = useTranslation();
  return (
    <ScreenBody title={t('trainer.routineRequests.title')} subtitle={t('trainer.routineRequests.subtitle')}>
      {ROUTINE_REQUESTS.map((r) => (
        <RequestCard key={r.id} request={r} />
      ))}
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: globals.colors.surface,
    borderRadius: globals.radius.lg,
    borderWidth: 1,
    borderColor: globals.colors.surfaceBorder,
    padding: globals.spacing.md,
    marginBottom: globals.spacing.md,
    ...globals.shadow.card,
  },
  head: { flexDirection: 'row', alignItems: 'center' },
  headTexts: { flex: 1, marginHorizontal: globals.spacing.md },
  name: { fontSize: globals.fontSize.md, fontWeight: '700', color: globals.colors.text },
  caption: { marginTop: 2, fontSize: globals.fontSize.sm, color: globals.colors.captionGrey },
  chip: {
    backgroundColor: globals.colors.tealSoft,
    borderRadius: globals.radius.full,
    paddingVertical: 4,
    paddingHorizontal: globals.spacing.sm + 2,
  },
  chipLabel: { fontSize: globals.fontSize.sm, fontWeight: '600', color: globals.colors.primary },
  details: {
    marginTop: globals.spacing.md,
    paddingTop: globals.spacing.md,
    borderTopWidth: 1,
    borderTopColor: globals.colors.surfaceBorder,
    gap: 4,
  },
  detail: { fontSize: globals.fontSize.md, color: globals.colors.text },
  actions: { flexDirection: 'row', gap: globals.spacing.sm, marginTop: globals.spacing.md },
  btn: { flex: 1, alignItems: 'center', borderRadius: globals.radius.full, paddingVertical: 12 },
  btnPrimary: { backgroundColor: globals.colors.primary },
  btnPrimaryLabel: { color: '#fff', fontWeight: '700', fontSize: globals.fontSize.md },
  btnOutline: { borderWidth: 1.5, borderColor: globals.colors.primary, backgroundColor: globals.colors.surface },
  btnOutlineLabel: { color: globals.colors.primary, fontWeight: '700', fontSize: globals.fontSize.md },
});
