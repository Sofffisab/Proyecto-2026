// src/screens/admin/MembersScreen.js
//
// Members Screen (Admin) - spec section 15.
// "Crear sesión nueva" -> POST /auth/users (sends the "Mail de Sesión
// Nueva"). "Visor de sesiones" -> GET /users (role, name, email, seniority,
// active status, trainer rating). "Desactivar/Activar cuenta" ->
// PATCH /users/:id/status.

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import * as authApi from '../../api/services/auth.api';
import * as userApi from '../../api/services/user.api';

const ROLES = ['USER', 'TRAINER', 'ADMIN'];

/**
 * @param {function} [onBack]
 */
export default function MembersScreen({ onBack }) {
  const { t } = useTranslation();

  // Create-session form
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('USER');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [createSuccess, setCreateSuccess] = useState(false);

  // Session viewer
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hadError, setHadError] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [statusError, setStatusError] = useState(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setHadError(false);
    try {
      const res = await userApi.getUsers({ limit: 100 });
      setUsers(res.data ?? []);
    } catch {
      setHadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [loadUsers])
  );

  const handleCreateSession = async () => {
    setCreateError(null);
    setCreateSuccess(false);

    if (!email.trim()) {
      setCreateError(t('admin.members.emailRequired'));
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setCreateError(t('admin.members.nameRequired'));
      return;
    }

    setCreating(true);
    try {
      await authApi.createUserByAdmin({
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
      });
      setCreateSuccess(true);
      setEmail('');
      setFirstName('');
      setLastName('');
      setRole('USER');
      await loadUsers();
    } catch (err) {
      setCreateError(err.message || t('admin.members.createError'));
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (targetUser) => {
    setStatusError(null);
    setUpdatingUserId(targetUser.id);
    try {
      await userApi.setUserActive(targetUser.id, !targetUser.isActive);
      await loadUsers();
    } catch (err) {
      setStatusError(err.message || t('admin.members.statusUpdateError'));
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('admin.members.createNewSession')}</Text>

        <TextInput
          style={styles.input}
          placeholder={t('admin.members.firstNamePlaceholder')}
          value={firstName}
          onChangeText={setFirstName}
        />
        <TextInput
          style={styles.input}
          placeholder={t('admin.members.lastNamePlaceholder')}
          value={lastName}
          onChangeText={setLastName}
        />
        <TextInput
          style={styles.input}
          placeholder={t('admin.members.mailPlaceholder')}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.roleLabel}>{t('admin.members.roleLabel')}</Text>
        <View style={styles.roleRow}>
          {ROLES.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.roleChip, role === r && styles.roleChipSelected]}
              onPress={() => setRole(r)}
            >
              <Text style={[styles.roleChipText, role === r && styles.roleChipTextSelected]}>
                {t(`admin.members.role${r.charAt(0)}${r.slice(1).toLowerCase()}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {createError && <Text style={styles.errorText}>{createError}</Text>}
        {createSuccess && <Text style={styles.successText}>{t('admin.members.createSuccess')}</Text>}

        <TouchableOpacity style={styles.submitButton} onPress={handleCreateSession} disabled={creating}>
          {creating ? (
            <ActivityIndicator color={globals.colors.secondary} />
          ) : (
            <Text style={styles.submitButtonText}>{t('admin.members.createSubmit')}</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('admin.members.sessionViewer')}</Text>

        {loading && (
          <View style={styles.centerRow}>
            <ActivityIndicator color={globals.colors.primary} />
          </View>
        )}

        {!loading && hadError && <Text style={styles.errorText}>{t('admin.members.loadError')}</Text>}
        {!loading && statusError && <Text style={styles.errorText}>{statusError}</Text>}

        {!loading && !hadError && users.length === 0 && (
          <Text style={styles.emptyText}>{t('admin.members.empty')}</Text>
        )}

        {users.map((u) => (
          <View key={u.id} style={styles.userRow}>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {u.firstName} {u.lastName} · {u.role}
              </Text>
              <Text style={styles.userDetail}>{u.email}</Text>
              <Text style={styles.userDetail}>
                {t('admin.members.since', { date: new Date(u.createdAt).toLocaleDateString() })}
              </Text>
              {u.role === 'TRAINER' && (
                <Text style={styles.userDetail}>
                  {u.trainerProfile?.totalRatings > 0
                    ? t('admin.members.ratingLabel', { rating: u.trainerProfile.averageRating.toFixed(2) })
                    : t('admin.members.noRating')}
                </Text>
              )}
              <Text style={u.isActive ? styles.statusActive : styles.statusInactive}>
                {u.isActive ? t('admin.members.statusActive') : t('admin.members.statusInactive')}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.toggleButton, u.isActive && styles.toggleButtonDanger]}
              onPress={() => handleToggleActive(u)}
              disabled={updatingUserId === u.id}
            >
              {updatingUserId === u.id ? (
                <ActivityIndicator color={globals.colors.secondary} size="small" />
              ) : (
                <Text style={styles.toggleButtonText}>
                  {u.isActive ? t('admin.members.deactivateAccount') : t('admin.members.activateAccount')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLink}>{t('admin.members.back')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: globals.colors.background,
  },
  content: {
    padding: globals.spacing.md,
  },
  section: {
    backgroundColor: globals.colors.sectionCard,
    borderRadius: globals.radius.lg,
    padding: globals.spacing.md,
    marginBottom: globals.spacing.md,
  },
  sectionTitle: {
    fontSize: globals.fontSize.md,
    fontWeight: '700',
    color: globals.colors.text,
    marginBottom: globals.spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    padding: globals.spacing.sm,
    color: globals.colors.text,
    marginBottom: globals.spacing.sm,
  },
  roleLabel: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    marginBottom: globals.spacing.xs,
  },
  roleRow: {
    flexDirection: 'row',
    marginBottom: globals.spacing.sm,
  },
  roleChip: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.xs,
    paddingHorizontal: globals.spacing.sm,
    marginRight: globals.spacing.sm,
  },
  roleChipSelected: {
    backgroundColor: globals.colors.primary,
    borderColor: globals.colors.primary,
  },
  roleChipText: {
    color: globals.colors.text,
    fontSize: globals.fontSize.sm,
  },
  roleChipTextSelected: {
    color: globals.colors.secondary,
    fontWeight: '600',
  },
  errorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    marginBottom: globals.spacing.sm,
    textAlign: 'center',
  },
  successText: {
    color: globals.colors.primary,
    fontSize: globals.fontSize.sm,
    marginBottom: globals.spacing.sm,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.sm,
    alignItems: 'center',
  },
  submitButtonText: {
    color: globals.colors.secondary,
    fontWeight: '600',
  },
  centerRow: {
    alignItems: 'center',
    marginVertical: globals.spacing.sm,
  },
  emptyText: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    textAlign: 'center',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: globals.colors.border,
    paddingVertical: globals.spacing.sm,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: globals.fontSize.sm,
    fontWeight: '600',
    color: globals.colors.text,
  },
  userDetail: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
  },
  statusActive: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  statusInactive: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.danger,
    fontWeight: '600',
    marginTop: 2,
  },
  toggleButton: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.xs,
    paddingHorizontal: globals.spacing.sm,
    marginLeft: globals.spacing.sm,
  },
  toggleButtonDanger: {
    backgroundColor: globals.colors.danger,
  },
  toggleButtonText: {
    color: globals.colors.secondary,
    fontSize: globals.fontSize.sm,
    fontWeight: '600',
  },
  backLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginVertical: globals.spacing.lg,
  },
});
