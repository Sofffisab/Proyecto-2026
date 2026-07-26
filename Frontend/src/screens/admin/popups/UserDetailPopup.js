// src/screens/admin/popups/UserDetailPopup.js
//
// Pop-up that opens when an Admin taps a user row on the Members screen
// (spec section 15). This closes a gap that used to exist: the list only
// showed a flat row per user; there was no detail view and no way to
// change an existing user's role after creation.
//
// Backend wiring:
//   GET   /users/:id              -> full profile detail (user.api.js)
//   PATCH /users/:id/role         -> change role USER/TRAINER/ADMIN (user.api.js)
//   POST  /users/:id/trainer-profile -> create/update the trainer profile
//                                        (specialty) when promoting to TRAINER

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import globals from '../../../styles/globals';
import { useTranslation } from '../../../i18n/I18nContext';
import * as userApi from '../../../api/services/user.api';

const ROLE_OPTIONS = ['USER', 'TRAINER', 'ADMIN'];

/**
 * @param {string} userId - id of the user to display/edit.
 * @param {function} [onClose] - close button / dismiss.
 * @param {function} [onRoleChanged] - called with the updated user after a
 *   successful role change, so the caller can refresh its own list.
 */
export default function UserDetailPopup({ userId, onClose, onRoleChanged }) {
  const { t } = useTranslation();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [savingRole, setSavingRole] = useState(false);
  const [roleMessage, setRoleMessage] = useState(null);
  const [specialty, setSpecialty] = useState('');
  const [savingTrainerProfile, setSavingTrainerProfile] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await userApi.getUserById(userId);
      setUser(data);
    } catch (err) {
      setError(err.message || t('admin.members.userDetailLoadError'));
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleChangeRole = async (role) => {
    if (!user || role === user.role) return;
    setSavingRole(true);
    setRoleMessage(null);
    try {
      const { data } = await userApi.changeUserRole(user.id, role);
      setUser((prev) => ({ ...prev, ...data }));
      setRoleMessage({ type: 'success', text: t('admin.members.roleChangeSuccess') });
      if (onRoleChanged) onRoleChanged({ ...user, ...data });
    } catch (err) {
      setRoleMessage({ type: 'error', text: err.message || t('admin.members.roleChangeError') });
    } finally {
      setSavingRole(false);
    }
  };

  const handleSaveTrainerProfile = async () => {
    if (!user || !specialty.trim()) {
      setRoleMessage({ type: 'error', text: t('admin.members.trainerSpecialtyRequired') });
      return;
    }
    setSavingTrainerProfile(true);
    setRoleMessage(null);
    try {
      const { data } = await userApi.upsertTrainerProfile(user.id, { specialty: specialty.trim() });
      setUser((prev) => ({ ...prev, trainerProfile: data }));
      setRoleMessage({ type: 'success', text: t('admin.members.trainerProfileSuccess') });
    } catch (err) {
      setRoleMessage({ type: 'error', text: err.message || t('admin.members.trainerProfileError') });
    } finally {
      setSavingTrainerProfile(false);
    }
  };

  const personName = (u) => `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || u?.email || '—';

  return (
    <View style={styles.overlay}>
      <ScrollView style={styles.card} contentContainerStyle={styles.cardContent}>
        <Text style={styles.title}>{t('admin.members.userDetailTitle')}</Text>

        {loading && <ActivityIndicator color={globals.colors.primary} />}
        {error && <Text style={styles.errorText}>{error}</Text>}

        {!loading && user && (
          <>
            <Text style={styles.subtitle}>{personName(user)}</Text>

            <Text style={styles.sectionLabel}>{t('admin.members.email')}</Text>
            <Text style={styles.bodyText}>{user.email}</Text>

            <Text style={styles.sectionLabel}>{t('admin.members.status')}</Text>
            <Text style={styles.bodyText}>
              {user.isActive ? t('admin.members.active') : t('admin.members.inactive')}
            </Text>

            {user.medicalConditions ? (
              <>
                <Text style={styles.sectionLabel}>{t('admin.members.medicalConditions')}</Text>
                <Text style={styles.bodyText}>{user.medicalConditions}</Text>
              </>
            ) : null}

            {user.objectives ? (
              <>
                <Text style={styles.sectionLabel}>{t('admin.members.objectives')}</Text>
                <Text style={styles.bodyText}>{user.objectives}</Text>
              </>
            ) : null}

            {user.trainingLevel ? (
              <>
                <Text style={styles.sectionLabel}>{t('admin.members.trainingLevel')}</Text>
                <Text style={styles.bodyText}>{user.trainingLevel}</Text>
              </>
            ) : null}

            <Text style={styles.sectionLabel}>{t('admin.members.role')}</Text>
            <View style={styles.roleRow}>
              {ROLE_OPTIONS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChip, user.role === r && styles.roleChipSelected]}
                  onPress={() => handleChangeRole(r)}
                  disabled={savingRole}
                >
                  <Text style={[styles.roleChipText, user.role === r && styles.roleChipTextSelected]}>
                    {t(`admin.members.roles.${r}`)}
                  </Text>
                </TouchableOpacity>
              ))}
              {savingRole && <ActivityIndicator color={globals.colors.primary} size="small" />}
            </View>

            {user.role === 'TRAINER' && (
              <>
                <Text style={styles.sectionLabel}>
                  {user.trainerProfile ? t('admin.members.trainerSpecialtyPlaceholder') : t('admin.members.trainerSpecialtyRequired')}
                </Text>
                {user.trainerProfile?.specialty ? (
                  <Text style={styles.bodyText}>{user.trainerProfile.specialty}</Text>
                ) : null}
                <TextInput
                  style={styles.input}
                  placeholder={t('admin.members.trainerSpecialtyPlaceholder')}
                  placeholderTextColor={globals.colors.textMuted}
                  value={specialty}
                  onChangeText={setSpecialty}
                  editable={!savingTrainerProfile}
                />
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveTrainerProfile}
                  disabled={savingTrainerProfile}
                >
                  {savingTrainerProfile ? (
                    <ActivityIndicator color={globals.colors.secondary} size="small" />
                  ) : (
                    <Text style={styles.saveButtonText}>{t('common.save')}</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {roleMessage && (
              <Text style={roleMessage.type === 'error' ? styles.errorText : styles.successText}>
                {roleMessage.text}
              </Text>
            )}
          </>
        )}

        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>{t('admin.members.close')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: globals.spacing.md,
  },
  card: {
    backgroundColor: globals.colors.background,
    borderRadius: globals.radius.lg,
    maxHeight: '85%',
  },
  cardContent: { padding: globals.spacing.md },
  title: { fontSize: globals.fontSize.lg, fontWeight: 'bold', color: globals.colors.text },
  subtitle: { fontSize: globals.fontSize.md, color: globals.colors.textMuted, marginBottom: globals.spacing.md },
  sectionLabel: {
    fontSize: globals.fontSize.md,
    fontWeight: '600',
    color: globals.colors.text,
    marginTop: globals.spacing.md,
    marginBottom: globals.spacing.xs,
  },
  bodyText: { fontSize: globals.fontSize.md, color: globals.colors.text },
  errorText: { color: globals.colors.danger, fontSize: globals.fontSize.sm, marginTop: globals.spacing.sm },
  successText: { color: globals.colors.primary, fontSize: globals.fontSize.sm, marginTop: globals.spacing.sm },
  roleRow: { flexDirection: 'row', gap: globals.spacing.xs, alignItems: 'center' },
  roleChip: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.sm,
    paddingHorizontal: globals.spacing.sm,
    paddingVertical: globals.spacing.xs,
  },
  roleChipSelected: {
    borderColor: globals.colors.primary,
    backgroundColor: globals.colors.primary + '20',
  },
  roleChipText: { fontSize: globals.fontSize.sm, color: globals.colors.text },
  roleChipTextSelected: { color: globals.colors.primary, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    padding: globals.spacing.sm,
    color: globals.colors.text,
    marginTop: globals.spacing.sm,
  },
  saveButton: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.sm,
    alignItems: 'center',
    marginTop: globals.spacing.sm,
  },
  saveButtonText: { color: globals.colors.secondary, fontWeight: '600' },
  closeButton: { marginTop: globals.spacing.md, alignItems: 'center' },
  closeButtonText: { color: globals.colors.textMuted },
});
