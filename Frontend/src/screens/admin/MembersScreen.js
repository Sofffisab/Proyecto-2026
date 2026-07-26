// src/screens/admin/MembersScreen.js
//
// Members Screen (Admin) - spec section 15.
//
// Backend wiring:
//   GET  /users                -> paginated account list, incl. trainer
//                                  rating (auth.controller/user.controller)  (user.api.js)
//   POST /auth/users           -> "Crear sesión nueva": creates the account
//                                  and sends the "Mail de Sesión Nueva"      (auth.api.js)
//   PATCH /users/:id/status    -> "Desactivar/Activar cuenta"                (user.api.js)

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import * as authApi from '../../api/services/auth.api';
import * as userApi from '../../api/services/user.api';
import UserDetailPopup from './popups/UserDetailPopup';

const ROLE_OPTIONS = ['USER', 'TRAINER', 'ADMIN'];

/**
 * @param {function} [onBack]
 */
export default function MembersScreen({ onBack }) {
  const { t } = useTranslation();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);

  // Create-session form
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('USER');
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await userApi.getUsers({ limit: 100, offset: 0 });
      setUsers(data ?? []);
      setError(null);
    } catch (err) {
      setError(err.message || t('admin.members.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const personName = (u) => `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || u?.email || '—';

  const handleCreateSession = async () => {
    if (!email.trim() || !firstName.trim() || !lastName.trim()) {
      setCreateMessage({ type: 'error', text: t('admin.members.errorFillFields') });
      return;
    }
    setCreating(true);
    setCreateMessage(null);
    try {
      await authApi.createUserByAdmin({
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
      });
      setCreateMessage({ type: 'success', text: t('admin.members.createSuccess') });
      setEmail('');
      setFirstName('');
      setLastName('');
      setRole('USER');
      await load();
    } catch (err) {
      setCreateMessage({ type: 'error', text: err.message || t('admin.members.createError') });
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (user) => {
    setBusyId(user.id);
    try {
      const { data } = await userApi.setUserActive(user.id, !user.isActive);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: data.isActive } : u)));
    } catch (err) {
      setError(err.message || t('admin.members.actionError'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Create new session */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('admin.members.createNewSession')}</Text>

        <TextInput
          style={styles.input}
          placeholder={t('admin.members.mailPlaceholder')}
          placeholderTextColor={globals.colors.textMuted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!creating}
        />
        <TextInput
          style={styles.input}
          placeholder={t('admin.members.firstNamePlaceholder')}
          placeholderTextColor={globals.colors.textMuted}
          value={firstName}
          onChangeText={setFirstName}
          editable={!creating}
        />
        <TextInput
          style={styles.input}
          placeholder={t('admin.members.lastNamePlaceholder')}
          placeholderTextColor={globals.colors.textMuted}
          value={lastName}
          onChangeText={setLastName}
          editable={!creating}
        />

        <View style={styles.roleRow}>
          {ROLE_OPTIONS.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.roleChip, role === r && styles.roleChipSelected]}
              onPress={() => setRole(r)}
              disabled={creating}
            >
              <Text style={[styles.roleChipText, role === r && styles.roleChipTextSelected]}>
                {t(`admin.members.roles.${r}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {createMessage && (
          <Text style={createMessage.type === 'error' ? styles.errorText : styles.successText}>
            {createMessage.text}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.button, creating && styles.buttonDisabled]}
          onPress={handleCreateSession}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator color={globals.colors.background} />
          ) : (
            <Text style={styles.buttonText}>{t('admin.members.createNewSession')}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Session viewer */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('admin.members.sessionViewer')}</Text>

        {loading && <ActivityIndicator color={globals.colors.primary} style={styles.spinner} />}
        {error && <Text style={styles.errorText}>{error}</Text>}

        {!loading && users.length === 0 && (
          <Text style={styles.mutedText}>{t('admin.members.noUsers')}</Text>
        )}

        {users.map((u) => (
          <TouchableOpacity
            key={u.id}
            style={styles.userRow}
            onPress={() => setSelectedUserId(u.id)}
            activeOpacity={0.7}
          >
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{personName(u)}</Text>
              <Text style={styles.mutedText}>
                {u.email} · {t(`admin.members.roles.${u.role}`)}
                {!u.isActive ? ` · ${t('admin.members.inactive')}` : ''}
              </Text>
              {u.role === 'TRAINER' && u.trainerProfile && (
                <Text style={styles.mutedText}>
                  {t('admin.members.rating', {
                    rating: (u.trainerProfile.averageRating ?? 0).toFixed(1),
                  })}
                </Text>
              )}
              <Text style={styles.mutedText}>
                {t('admin.members.since', {
                  date: u.createdAt ? String(u.createdAt).slice(0, 10) : '—',
                })}
              </Text>
              <Text style={styles.viewDetailsLink}>{t('admin.members.viewDetails')}</Text>
            </View>

            <TouchableOpacity
              style={[styles.smallButton, u.isActive ? styles.dangerButton : styles.successButton]}
              onPress={(e) => {
                e.stopPropagation?.();
                handleToggleActive(u);
              }}
              disabled={busyId === u.id}
            >
              {busyId === u.id ? (
                <ActivityIndicator color={globals.colors.secondary} size="small" />
              ) : (
                <Text style={styles.smallButtonText}>
                  {u.isActive
                    ? t('admin.members.deactivateAccount')
                    : t('admin.members.activateAccount')}
                </Text>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLink}>{t('admin.members.back')}</Text>
      </TouchableOpacity>

      <Modal
        visible={!!selectedUserId}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedUserId(null)}
      >
        <UserDetailPopup
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onRoleChanged={(updated) => {
            setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
          }}
        />
      </Modal>
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
    gap: globals.spacing.sm,
  },
  cardTitle: {
    fontSize: globals.fontSize.md,
    fontWeight: '600',
    color: globals.colors.text,
    marginBottom: globals.spacing.xs,
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
  roleRow: {
    flexDirection: 'row',
    gap: globals.spacing.xs,
  },
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
  roleChipText: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.text,
  },
  roleChipTextSelected: {
    color: globals.colors.primary,
    fontWeight: '600',
  },
  button: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: globals.colors.background,
    fontSize: globals.fontSize.md,
    fontWeight: '600',
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: globals.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: globals.colors.border,
    gap: globals.spacing.sm,
  },
  userInfo: { flex: 1, gap: 2 },
  userName: { fontSize: globals.fontSize.md, color: globals.colors.text, fontWeight: '600' },
  viewDetailsLink: { fontSize: globals.fontSize.sm, color: globals.colors.primary, marginTop: 2 },
  mutedText: { fontSize: globals.fontSize.sm, color: globals.colors.textMuted },
  smallButton: {
    borderRadius: globals.radius.sm,
    paddingVertical: globals.spacing.xs,
    paddingHorizontal: globals.spacing.sm,
  },
  dangerButton: { backgroundColor: globals.colors.danger },
  successButton: { backgroundColor: globals.colors.primary },
  smallButtonText: { color: globals.colors.secondary, fontSize: globals.fontSize.sm, fontWeight: '600' },
  errorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
  },
  successText: {
    color: globals.colors.primary,
    fontSize: globals.fontSize.sm,
  },
  backLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginVertical: globals.spacing.lg,
  },
});
