// Admin "Miembros" — mockup "Pantalla miembros admin":
//  - Create a new session (email only: the person gets a mail with their
//    account data and sets a new password on first entry)
//  - Sessions viewer: role, name, basic data, since when, active/deactivated
//    (trainers also show their rating)
//  - Deactivate (account is kept, the person just can't use the app) and
//    re-activate buttons
// Static (see mockData.js).

import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import ScreenBody from '../../components/trainer/ScreenBody';
import Avatar from '../../components/trainer/Avatar';
import Card from '../../components/admin/Card';
import SectionTitle from '../../components/admin/SectionTitle';
import StatusPill from '../../components/admin/StatusPill';
import AdminButton from '../../components/admin/AdminButton';
import { StarIcon } from '../../components/admin/AdminIcons';
import { MEMBERS } from './mockData';

export default function AdminMembersScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');

  return (
    <ScreenBody title={t('admin.members.title')} subtitle={t('admin.members.subtitle')}>
      {/* ---- Create session ---- */}
      <Card>
        <Text style={styles.cardTitle}>{t('admin.members.createTitle')}</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder={t('admin.members.emailPlaceholder')}
          placeholderTextColor={globals.colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={t('admin.members.emailLabel')}
        />
        <Text style={styles.hint}>{t('admin.members.createHint')}</Text>
        <AdminButton
          label={t('admin.members.createButton')}
          variant="primary"
          disabled={!email.trim()}
          style={styles.createBtn}
        />
      </Card>

      {/* ---- Sessions viewer ---- */}
      <SectionTitle>{t('admin.members.sessionsTitle')}</SectionTitle>
      {MEMBERS.map((m) => (
        <Card key={m.id}>
          <View style={styles.head}>
            <Avatar name={m.name} size={44} />
            <View style={styles.headTexts}>
              <Text style={styles.name} numberOfLines={1}>{m.name}</Text>
              <Text style={styles.caption} numberOfLines={1}>{m.email}</Text>
            </View>
            <StatusPill label={t(`admin.roles.${m.role}`)} tone={m.role === 'user' ? 'grey' : 'teal'} />
          </View>

          <View style={styles.details}>
            <Text style={styles.detail}>{t('admin.members.since', { date: m.since })}</Text>
            {m.role === 'trainer' && (
              <View style={styles.ratingRow}>
                <StarIcon color={globals.colors.primary} size={16} />
                <Text style={styles.detail}>{t('admin.members.rating', { rating: m.rating })}</Text>
              </View>
            )}
            <StatusPill
              label={m.active ? t('admin.members.active') : t('admin.members.deactivated')}
              tone={m.active ? 'teal' : 'danger'}
            />
          </View>

          {m.active ? (
            <AdminButton label={t('admin.members.deactivate')} variant="danger" style={styles.rowBtn} />
          ) : (
            <AdminButton label={t('admin.members.activate')} variant="primary" style={styles.rowBtn} />
          )}
        </Card>
      ))}
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: globals.fontSize.md, fontWeight: '700', color: globals.colors.text },
  input: {
    marginTop: globals.spacing.sm,
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    padding: globals.spacing.md,
    color: globals.colors.text,
  },
  hint: { marginTop: globals.spacing.sm, fontSize: globals.fontSize.sm, color: globals.colors.captionGrey, lineHeight: 17 },
  createBtn: { marginTop: globals.spacing.md },
  head: { flexDirection: 'row', alignItems: 'center' },
  headTexts: { flex: 1, marginHorizontal: globals.spacing.md },
  name: { fontSize: globals.fontSize.md, fontWeight: '700', color: globals.colors.text },
  caption: { marginTop: 2, fontSize: globals.fontSize.sm, color: globals.colors.captionGrey },
  details: {
    marginTop: globals.spacing.md,
    paddingTop: globals.spacing.md,
    borderTopWidth: 1,
    borderTopColor: globals.colors.surfaceBorder,
    gap: 6,
  },
  detail: { fontSize: globals.fontSize.md, color: globals.colors.text },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowBtn: { marginTop: globals.spacing.md },
});
