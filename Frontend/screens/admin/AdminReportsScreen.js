// Admin "Revisar denuncias" — mockup "Pantalla denuncias admin":
//  - Reports made & approved (view them and decide whether to remove them)
//  - Review requests (verify that a previous report was really wrongly applied)
//  - Suspicious behavior (too many reports received / made)
// Static (see mockData.js).

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import ScreenBody from '../../components/trainer/ScreenBody';
import Avatar from '../../components/trainer/Avatar';
import Card from '../../components/admin/Card';
import SectionTitle from '../../components/admin/SectionTitle';
import StatusPill from '../../components/admin/StatusPill';
import AdminButton from '../../components/admin/AdminButton';
import { APPROVED_REPORTS, REVIEW_REQUESTS, SUSPICIOUS } from './mockData';

export default function AdminReportsScreen() {
  const { t } = useTranslation();
  return (
    <ScreenBody title={t('admin.reports.title')} subtitle={t('admin.reports.subtitle')}>
      {/* ---- Approved reports ---- */}
      <SectionTitle>{t('admin.reports.approvedTitle')}</SectionTitle>
      {APPROVED_REPORTS.map((r) => (
        <Card key={r.id}>
          <View style={styles.head}>
            <Avatar name={r.reported} size={44} />
            <View style={styles.headTexts}>
              <Text style={styles.name} numberOfLines={1}>{r.reported}</Text>
              <Text style={styles.caption}>{t('admin.reports.reportedBy', { name: r.by, date: r.date })}</Text>
            </View>
          </View>
          <Text style={styles.body}>{r.reason}</Text>
          <View style={styles.actions}>
            <AdminButton label={t('admin.reports.keep')} style={styles.action} />
            <AdminButton label={t('admin.reports.remove')} variant="danger" style={styles.action} />
          </View>
        </Card>
      ))}

      {/* ---- Review requests ---- */}
      <SectionTitle>{t('admin.reports.reviewTitle')}</SectionTitle>
      <Text style={styles.sectionHint}>{t('admin.reports.reviewHint')}</Text>
      {REVIEW_REQUESTS.map((q) => (
        <Card key={q.id}>
          <View style={styles.head}>
            <Avatar name={q.name} size={44} />
            <View style={styles.headTexts}>
              <Text style={styles.name} numberOfLines={1}>{q.name}</Text>
              <Text style={styles.caption}>{t('admin.reports.reviewOf', { date: q.reportDate })}</Text>
            </View>
          </View>
          <Text style={styles.body}>{q.message}</Text>
          <View style={styles.actions}>
            <AdminButton label={t('admin.reports.wasWrong')} variant="primary" style={styles.action} />
            <AdminButton label={t('admin.reports.wasRight')} style={styles.action} />
          </View>
        </Card>
      ))}

      {/* ---- Suspicious behavior ---- */}
      <SectionTitle>{t('admin.reports.suspiciousTitle')}</SectionTitle>
      <Text style={styles.sectionHint}>{t('admin.reports.suspiciousHint')}</Text>
      {SUSPICIOUS.map((s) => (
        <Card key={s.id}>
          <View style={styles.head}>
            <Avatar name={s.name} size={44} />
            <View style={styles.headTexts}>
              <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
              <Text style={styles.caption}>
                {t(s.kind === 'received' ? 'admin.reports.receivedMany' : 'admin.reports.madeMany', { count: s.count, days: s.days })}
              </Text>
            </View>
            <StatusPill
              label={t(s.kind === 'received' ? 'admin.reports.tagReceived' : 'admin.reports.tagMade')}
              tone="danger"
            />
          </View>
          <View style={styles.actions}>
            <AdminButton label={t('admin.reports.viewDetail')} style={styles.action} />
          </View>
        </Card>
      ))}
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center' },
  headTexts: { flex: 1, marginHorizontal: globals.spacing.md },
  name: { fontSize: globals.fontSize.md, fontWeight: '700', color: globals.colors.text },
  caption: { marginTop: 2, fontSize: globals.fontSize.sm, color: globals.colors.captionGrey },
  body: { marginTop: globals.spacing.md, fontSize: globals.fontSize.md, color: globals.colors.text, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: globals.spacing.sm, marginTop: globals.spacing.md },
  action: { flex: 1 },
  sectionHint: { marginTop: -globals.spacing.xs, marginBottom: globals.spacing.sm, fontSize: globals.fontSize.sm, color: globals.colors.captionGrey, lineHeight: 17 },
});
