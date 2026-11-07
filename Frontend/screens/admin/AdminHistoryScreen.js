// Admin "Historial" — mockup "Pantalla historial admin": total record of what
// happens in every account of the app (anything private is already left out
// by the privacy filter). Filter chips narrow it by who did the action.
// Static (see mockData.js).

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import ScreenBody from '../../components/trainer/ScreenBody';
import Avatar from '../../components/trainer/Avatar';
import Card from '../../components/admin/Card';
import Chips from '../../components/admin/Chips';
import StatusPill from '../../components/admin/StatusPill';
import { HISTORY_LOG } from './mockData';

export default function AdminHistoryScreen() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('all');

  const options = [
    { key: 'all', label: t('admin.history.filterAll') },
    { key: 'admin', label: t('admin.history.filterAdmins') },
    { key: 'trainer', label: t('admin.history.filterTrainers') },
    { key: 'user', label: t('admin.history.filterUsers') },
  ];
  const rows = filter === 'all' ? HISTORY_LOG : HISTORY_LOG.filter((r) => r.role === filter);

  return (
    <ScreenBody title={t('admin.history.title')} subtitle={t('admin.history.subtitle')}>
      <Chips options={options} value={filter} onChange={setFilter} />
      <Text style={styles.privacy}>{t('admin.history.privacyNote')}</Text>

      {rows.map((r) => (
        <Card key={r.id}>
          <View style={styles.head}>
            <Avatar name={r.actor} size={40} />
            <View style={styles.headTexts}>
              <Text style={styles.name} numberOfLines={1}>{r.actor}</Text>
              <Text style={styles.caption}>{r.date}</Text>
            </View>
            <StatusPill label={t(`admin.roles.${r.role}`)} tone={r.role === 'user' ? 'grey' : 'teal'} />
          </View>
          <Text style={styles.action}>{r.action}</Text>
        </Card>
      ))}
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  privacy: { marginBottom: globals.spacing.md, fontSize: globals.fontSize.sm, color: globals.colors.captionGrey, lineHeight: 17 },
  head: { flexDirection: 'row', alignItems: 'center' },
  headTexts: { flex: 1, marginHorizontal: globals.spacing.md },
  name: { fontSize: globals.fontSize.md, fontWeight: '700', color: globals.colors.text },
  caption: { marginTop: 2, fontSize: globals.fontSize.sm, color: globals.colors.captionGrey },
  action: {
    marginTop: globals.spacing.md,
    paddingTop: globals.spacing.md,
    borderTopWidth: 1,
    borderTopColor: globals.colors.surfaceBorder,
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
    lineHeight: 21,
  },
});
