// Admin "Miembros":
//  - Create a new session: the person gets an email with a link to choose
//    their password (the account is created by the Backend, nothing is typed
//    by the admin but the email and, optionally, the role / name).
//  - Sessions viewer: every account with its role, since when, active or
//    deactivated (trainers also show their rating).
//  - Deactivate (the account and its history are kept, the person just cannot
//    use the app) and re-activate.
// All data comes from GET /admin/members.

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Platform, Share } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import { useAuth } from '../../context/AuthContext';
import useLoad from '../../hooks/useLoad';
import { formatDate } from '../../utils/format';
import * as adminApi from '../../apiClient/services/admin.api';
import ScreenBody from '../../components/trainer/ScreenBody';
import Avatar from '../../components/trainer/Avatar';
import Card from '../../components/admin/Card';
import Chips from '../../components/admin/Chips';
import FormField from '../../components/admin/FormField';
import SectionTitle from '../../components/admin/SectionTitle';
import StatusPill from '../../components/admin/StatusPill';
import AdminButton from '../../components/admin/AdminButton';
import StateView from '../../components/common/StateView';
import { StarIcon } from '../../components/admin/AdminIcons';

const loadMembers = async () => (await adminApi.getMembers()).data ?? [];

export default function AdminMembersScreen() {
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const { data: members, loading, error, reload } = useLoad(loadMembers);

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('USER');
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'ok' | 'warn' | 'error', message }
  const [busyId, setBusyId] = useState(null);
  const [inviteUrl, setInviteUrl] = useState(null); // shown when the mail could not be sent
  const [copied, setCopied] = useState(false);

  const roleOptions = [
    { key: 'USER', label: t('admin.roles.user') },
    { key: 'TRAINER', label: t('admin.roles.trainer') },
    { key: 'ADMIN', label: t('admin.roles.admin') },
  ];

  const create = useCallback(async () => {
    const body = { email: email.trim().toLowerCase(), role };
    if (firstName.trim()) body.firstName = firstName.trim();
    if (lastName.trim()) body.lastName = lastName.trim();

    setCreating(true);
    setFeedback(null);
    setInviteUrl(null);
    setCopied(false);
    try {
      const { data } = await adminApi.createMember(body);
      setInviteUrl(data?.emailSent ? null : data?.inviteUrl ?? null);
      setFeedback(
        data?.emailSent
          ? { type: 'ok', message: t('admin.members.createdSent', { email: body.email }) }
          : { type: 'warn', message: t('admin.members.createdNoMail', { email: body.email }) }
      );
      setEmail('');
      setFirstName('');
      setLastName('');
      setRole('USER');
      reload({ silent: true });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setCreating(false);
    }
  }, [email, firstName, lastName, role, reload, t]);

  const copyInvite = useCallback(async () => {
    if (!inviteUrl) return;
    try {
      if (Platform.OS === 'web' && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
        setCopied(true);
      } else {
        await Share.share({ message: inviteUrl });
      }
    } catch {
      /* the link is selectable, the admin can copy it by hand */
    }
  }, [inviteUrl]);

  const toggleActive = useCallback(
    async (member) => {
      setBusyId(member.id);
      setFeedback(null);
      try {
        await adminApi.setMemberActive(member.id, !member.isActive);
        await reload({ silent: true });
      } catch (err) {
        setFeedback({ type: 'error', message: err.message });
      } finally {
        setBusyId(null);
      }
    },
    [reload]
  );

  const resend = useCallback(
    async (member) => {
      setBusyId(member.id);
      setFeedback(null);
      setInviteUrl(null);
      setCopied(false);
      try {
        const { data } = await adminApi.resendInvite(member.id);
        setInviteUrl(data?.emailSent ? null : data?.inviteUrl ?? null);
        setFeedback(
          data?.emailSent
            ? { type: 'ok', message: t('admin.members.createdSent', { email: member.email }) }
            : { type: 'warn', message: t('admin.members.createdNoMail', { email: member.email }) }
        );
      } catch (err) {
        setFeedback({ type: 'error', message: err.message });
      } finally {
        setBusyId(null);
      }
    },
    [t]
  );

  return (
    <ScreenBody title={t('admin.members.title')} subtitle={t('admin.members.subtitle')}>
      {/* ---- Create session ---- */}
      <Card>
        <Text style={styles.cardTitle}>{t('admin.members.createTitle')}</Text>
        <View style={styles.fields}>
          <FormField
            value={email}
            onChangeText={setEmail}
            placeholder={t('admin.members.emailPlaceholder')}
            keyboardType="email-address"
          />
          <Text style={styles.label}>{t('admin.members.roleLabel')}</Text>
          <Chips options={roleOptions} value={role} onChange={setRole} />
          <FormField value={firstName} onChangeText={setFirstName} placeholder={t('admin.members.firstNameOptional')} autoCapitalize="words" />
          <FormField value={lastName} onChangeText={setLastName} placeholder={t('admin.members.lastNameOptional')} autoCapitalize="words" />
        </View>
        <Text style={styles.hint}>{t('admin.members.createHint')}</Text>
        {!!feedback && (
          <Text style={[styles.feedback, feedback.type === 'ok' && styles.ok, feedback.type === 'error' && styles.err]}>
            {feedback.message}
          </Text>
        )}
        {!!inviteUrl && (
          <View style={styles.inviteBox}>
            <Text style={styles.label}>{t('admin.members.inviteLinkTitle')}</Text>
            <Text selectable style={styles.inviteUrl}>{inviteUrl}</Text>
            <AdminButton
              label={copied ? t('admin.members.linkCopied') : t('admin.members.copyLink')}
              onPress={copyInvite}
              style={styles.rowBtn}
            />
          </View>
        )}
        <AdminButton
          label={creating ? t('admin.members.creating') : t('admin.members.createButton')}
          variant="primary"
          disabled={!email.trim() || creating}
          onPress={create}
          style={styles.createBtn}
        />
      </Card>

      {/* ---- Sessions viewer ---- */}
      <SectionTitle>{t('admin.members.sessionsTitle')}</SectionTitle>
      <StateView loading={loading} error={error} onRetry={reload} empty={!members?.length} emptyText={t('admin.members.empty')}>
        {(members ?? []).map((m) => (
          <Card key={m.id}>
            <View style={styles.head}>
              <Avatar name={m.name} size={44} />
              <View style={styles.headTexts}>
                <Text style={styles.name} numberOfLines={1}>{m.name}</Text>
                <Text style={styles.caption} numberOfLines={1}>{m.email}</Text>
              </View>
              <StatusPill label={t(`admin.roles.${m.role.toLowerCase()}`)} tone={m.role === 'USER' ? 'grey' : 'teal'} />
            </View>

            <View style={styles.details}>
              <Text style={styles.detail}>{t('admin.members.since', { date: formatDate(m.createdAt) })}</Text>
              {m.role === 'TRAINER' && (
                <View style={styles.ratingRow}>
                  <StarIcon color={globals.colors.primary} size={16} />
                  <Text style={styles.detail}>
                    {m.rating !== null ? t('admin.members.rating', { rating: m.rating }) : t('admin.members.noRatings')}
                  </Text>
                </View>
              )}
              <View style={styles.pills}>
                <StatusPill
                  label={m.isActive ? t('admin.members.active') : t('admin.members.deactivated')}
                  tone={m.isActive ? 'teal' : 'danger'}
                />
                {m.invitePending && <StatusPill label={t('admin.members.invitePending')} tone="grey" />}
              </View>
            </View>

            {m.invitePending && (
              <AdminButton
                label={t('admin.members.resendInvite')}
                onPress={() => resend(m)}
                disabled={busyId === m.id}
                style={styles.rowBtn}
              />
            )}
            {m.id !== me?.id &&
              (m.isActive ? (
                <AdminButton
                  label={t('admin.members.deactivate')}
                  variant="danger"
                  onPress={() => toggleActive(m)}
                  disabled={busyId === m.id}
                  style={styles.rowBtn}
                />
              ) : (
                <AdminButton
                  label={t('admin.members.activate')}
                  variant="primary"
                  onPress={() => toggleActive(m)}
                  disabled={busyId === m.id}
                  style={styles.rowBtn}
                />
              ))}
          </Card>
        ))}
      </StateView>
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: globals.fontSize.md, fontWeight: '700', color: globals.colors.text },
  fields: { marginTop: globals.spacing.sm },
  label: { fontSize: globals.fontSize.sm + 1, color: globals.colors.textSecondary, marginBottom: 4 },
  hint: { fontSize: globals.fontSize.sm, color: globals.colors.captionGrey, lineHeight: 17 },
  feedback: { marginTop: globals.spacing.sm, fontSize: globals.fontSize.sm + 1, color: globals.colors.textSecondary },
  ok: { color: globals.colors.primary },
  err: { color: globals.colors.danger },
  inviteBox: { marginTop: globals.spacing.sm },
  inviteUrl: { fontSize: globals.fontSize.sm, color: globals.colors.text },
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
  pills: { flexDirection: 'row', gap: globals.spacing.sm, flexWrap: 'wrap' },
  rowBtn: { marginTop: globals.spacing.md },
});
