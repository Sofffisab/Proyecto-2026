// src/screens/trainer/HelpScreen.js
//
// Help Screen (Trainer) - spec section 12.
// "Lista de personas en el gym" ordenada por prioridad proveniente del
// backend (GET /gym/priority-assistance). Each row is clickable to open
// the profile data pop-up, and has a "Seleccionar Usuario" button that
// only does something when that person currently has a pending
// "Pedir Ayuda" request (GET /assistance/active) — selecting it assigns
// the request to this trainer and immediately marks it complete, which
// is what "marca al usuario en la app indicando que este entrenador fue
// a ayudarlo" means in practice for a single-tap trainer action.
//
// Note on the shape returned by GET /gym/priority-assistance (see
// Backend/src/services/gym.service.js#getPriorityAssistanceList): each
// entry is a GymSession row (not a bare user), spread with
// { lastAssistanceAt, specialtyMatch, prefersThisTrainer }. The actual
// student user lives at entry.user (id, firstName, lastName,
// medicalConditions, trainingLevel, objectives, settings).

import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import { useAuth } from '../../context/AuthContext';
import ProfileDataPopup from './popups/ProfileDataPopup';
import * as gymApi from '../../api/services/gym.api';
import * as assistanceApi from '../../api/services/assistance.api';

/**
 * @param {function} [onSelectUser] - Called with the student's userId after
 *   a successful assign+complete.
 * @param {function} [onBack]
 */
export default function HelpScreen({ onSelectUser, onBack }) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [sessions, setSessions] = useState([]);
  // userId -> { assistanceId, requestedAt }, only for PENDING requests
  // (the only status assign() accepts).
  const [pendingByUser, setPendingByUser] = useState({});
  const [loading, setLoading] = useState(true);
  const [hadError, setHadError] = useState(false);
  const [assigningUserId, setAssigningUserId] = useState(null);
  const [assignError, setAssignError] = useState(null);

  // Clicked profile data pop-up: opens/closes locally, doesn't need
  // its own entry in the navigation stack.
  const [selectedStudent, setSelectedStudent] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setHadError(false);

    const [listResult, activeResult] = await Promise.allSettled([
      gymApi.getPriorityAssistanceList(),
      assistanceApi.getActiveAssistance(),
    ]);

    if (listResult.status === 'fulfilled') {
      setSessions(listResult.value.data ?? []);
    } else {
      setHadError(true);
    }

    if (activeResult.status === 'fulfilled') {
      const map = {};
      (activeResult.value.data ?? []).forEach((a) => {
        if (a.status === 'PENDING') {
          map[a.userId] = { assistanceId: a.id, requestedAt: a.requestedAt };
        }
      });
      setPendingByUser(map);
    } else {
      setHadError(true);
    }

    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const handleSelectUser = async (studentUserId) => {
    const pending = pendingByUser[studentUserId];
    if (!pending || !user?.id) return;

    setAssignError(null);
    setAssigningUserId(studentUserId);
    try {
      await assistanceApi.assignAssistance(pending.assistanceId, user.id);
      await assistanceApi.completeAssistance(pending.assistanceId);
      await loadAll();
      if (onSelectUser) onSelectUser(studentUserId);
    } catch (err) {
      setAssignError(err.message || t('trainer.help.assignError'));
    } finally {
      setAssigningUserId(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('trainer.help.title')}</Text>

      {loading && (
        <View style={styles.centerRow}>
          <ActivityIndicator color={globals.colors.primary} />
          <Text style={styles.loadingText}>{t('trainer.help.loading')}</Text>
        </View>
      )}

      {!loading && hadError && <Text style={styles.errorText}>{t('trainer.help.loadError')}</Text>}
      {!loading && assignError && <Text style={styles.errorText}>{assignError}</Text>}

      {!loading && !hadError && sessions.length === 0 && (
        <Text style={styles.emptyText}>{t('trainer.help.empty')}</Text>
      )}

      {sessions.map((session) => {
        const student = session.user;
        const pending = pendingByUser[student.id];
        const isAssigning = assigningUserId === student.id;

        return (
          <View key={session.id} style={styles.card}>
            <TouchableOpacity style={styles.profileRow} onPress={() => setSelectedStudent(student)}>
              <View style={styles.avatarPlaceholder} />
              <View style={styles.profileInfo}>
                <Text style={styles.name}>
                  {student.firstName} {student.lastName}
                </Text>
                <View style={styles.badgeRow}>
                  {session.specialtyMatch && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{t('trainer.help.specialtyMatch')}</Text>
                    </View>
                  )}
                  {session.prefersThisTrainer && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{t('trainer.help.preferenceMatch')}</Text>
                    </View>
                  )}
                </View>
                <Text style={pending ? styles.pendingText : styles.notPendingText}>
                  {pending
                    ? t('trainer.help.waitingSince', {
                        time: new Date(pending.requestedAt).toLocaleTimeString(),
                      })
                    : t('trainer.help.noPendingRequest')}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.selectButton, !pending && styles.selectButtonDisabled]}
              onPress={() => handleSelectUser(student.id)}
              disabled={!pending || isAssigning}
            >
              {isAssigning ? (
                <ActivityIndicator color={globals.colors.secondary} />
              ) : (
                <Text style={styles.selectButtonText}>{t('trainer.help.selectUser')}</Text>
              )}
            </TouchableOpacity>
          </View>
        );
      })}

      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLink}>{t('trainer.help.back')}</Text>
      </TouchableOpacity>

      <Modal
        visible={Boolean(selectedStudent)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedStudent(null)}
      >
        {selectedStudent && (
          <ProfileDataPopup student={selectedStudent} onClose={() => setSelectedStudent(null)} />
        )}
      </Modal>
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
  title: {
    fontSize: globals.fontSize.lg,
    fontWeight: 'bold',
    color: globals.colors.text,
    marginBottom: globals.spacing.md,
  },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: globals.spacing.md,
  },
  loadingText: {
    marginLeft: globals.spacing.sm,
    color: globals.colors.textMuted,
  },
  errorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    marginBottom: globals.spacing.md,
    textAlign: 'center',
  },
  emptyText: {
    color: globals.colors.textMuted,
    fontSize: globals.fontSize.sm,
    textAlign: 'center',
    marginBottom: globals.spacing.md,
  },
  card: {
    backgroundColor: globals.colors.sectionCard,
    borderRadius: globals.radius.lg,
    padding: globals.spacing.md,
    marginBottom: globals.spacing.sm,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: globals.spacing.sm,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: globals.radius.full,
    backgroundColor: globals.colors.avatarPlaceholder,
    marginRight: globals.spacing.sm,
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: globals.fontSize.md,
    fontWeight: '600',
    color: globals.colors.text,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
  },
  badge: {
    backgroundColor: globals.colors.badge,
    borderRadius: globals.radius.sm,
    paddingHorizontal: globals.spacing.xs,
    paddingVertical: 2,
    marginRight: globals.spacing.xs,
    marginTop: 2,
  },
  badgeText: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.primary,
  },
  pendingText: {
    color: globals.colors.primary,
    fontSize: globals.fontSize.sm,
    marginTop: 2,
    fontWeight: '600',
  },
  notPendingText: {
    color: globals.colors.textMuted,
    fontSize: globals.fontSize.sm,
    marginTop: 2,
  },
  selectButton: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.sm,
    alignItems: 'center',
  },
  selectButtonDisabled: {
    backgroundColor: globals.colors.border,
  },
  selectButtonText: {
    color: globals.colors.secondary,
    fontWeight: '600',
  },
  backLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginVertical: globals.spacing.lg,
  },
});
