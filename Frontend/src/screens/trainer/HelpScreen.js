// src/screens/trainer/HelpScreen.js
//
// Help Screen (Trainer) - spec section 12.
// List of people at the gym, ordered by priority (backend).
//
// Backend wiring:
//   GET /gym/priority-assistance -> ordered member list  (gym.api.js)
//   GET /assistance/active       -> pending requests, to find a match for
//                                    "Seleccionar Usuario"  (assistance.api.js)
//   PATCH /assistance/:id/assign -> marks the matching pending request as
//                                    assigned to this trainer (assistance.api.js)
//   PATCH /assistance/:id/complete -> marks the assigned request as resolved
//                                      once the trainer is done helping
//                                      (assistance.api.js). The assistance id
//                                      returned by assign() above is kept in
//                                      local state so this screen can offer
//                                      "complete" for exactly the requests
//                                      this trainer picked up.

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import ProfileDataPopup from './popups/ProfileDataPopup';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import * as gymApi from '../../api/services/gym.api';
import * as assistanceApi from '../../api/services/assistance.api';

/**
 * @param {function} [onSelectUser]
 * @param {function} [onBack]
 */
export default function HelpScreen({ onSelectUser, onBack }) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [members, setMembers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [assigningId, setAssigningId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  // memberId -> assistanceId, for requests this trainer has assigned to
  // themselves and can now mark as complete.
  const [assignedByMember, setAssignedByMember] = useState({});
  const [completingId, setCompletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await gymApi.getPriorityAssistanceList();
      setMembers((data ?? []).map((row) => ({ ...row.user, sessionId: row.id })));
    } catch (err) {
      setError(err.message || t('trainer.help.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSelectUser = async (member) => {
    setAssigningId(member.id);
    setActionMessage(null);
    try {
      const { data: pending } = await assistanceApi.getActiveAssistance();
      const match = (pending ?? []).find((a) => a.userId === member.id && a.status === 'PENDING');
      if (!match) {
        setActionMessage(t('trainer.help.noPendingRequest'));
        return;
      }
      await assistanceApi.assignAssistance(match.id);
      setAssignedByMember((prev) => ({ ...prev, [member.id]: match.id }));
      setActionMessage(t('trainer.help.assigned'));
      if (onSelectUser) onSelectUser(member);
    } catch (err) {
      setActionMessage(err.message || t('trainer.help.assignError'));
    } finally {
      setAssigningId(null);
    }
  };

  const handleCompleteAssistance = async (member) => {
    const assistanceId = assignedByMember[member.id];
    if (!assistanceId) {
      setActionMessage(t('trainer.help.noActiveAssignment'));
      return;
    }
    setCompletingId(member.id);
    setActionMessage(null);
    try {
      await assistanceApi.completeAssistance(assistanceId);
      setAssignedByMember((prev) => {
        const next = { ...prev };
        delete next[member.id];
        return next;
      });
      setActionMessage(t('trainer.help.completeSuccess'));
    } catch (err) {
      setActionMessage(err.message || t('trainer.help.completeError'));
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('trainer.help.title')}</Text>

      {loading && <ActivityIndicator color={globals.colors.primary} style={styles.spinner} />}
      {error && <Text style={styles.errorText}>{error}</Text>}
      {actionMessage && <Text style={styles.infoText}>{actionMessage}</Text>}

      {!loading && members.length === 0 && (
        <Text style={styles.mutedText}>{t('trainer.help.empty')}</Text>
      )}

      {members.map((member) => (
        <View key={member.id} style={styles.row}>
          <TouchableOpacity style={styles.profileRow} onPress={() => setSelectedUser(member)}>
            <View style={styles.avatarPlaceholder} />
            <Text style={styles.rowTitle}>
              {`${member.firstName ?? ''} ${member.lastName ?? ''}`.trim() || member.id}
            </Text>
          </TouchableOpacity>
          <View style={styles.actionsCol}>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => handleSelectUser(member)}
              disabled={assigningId === member.id}
            >
              {assigningId === member.id ? (
                <ActivityIndicator color={globals.colors.secondary} size="small" />
              ) : (
                <Text style={styles.selectButtonText}>{t('trainer.help.selectUser')}</Text>
              )}
            </TouchableOpacity>

            {assignedByMember[member.id] && (
              <TouchableOpacity
                style={styles.completeButton}
                onPress={() => handleCompleteAssistance(member)}
                disabled={completingId === member.id}
              >
                {completingId === member.id ? (
                  <ActivityIndicator color={globals.colors.secondary} size="small" />
                ) : (
                  <Text style={styles.selectButtonText}>{t('trainer.help.completeHelp')}</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}

      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLink}>{t('trainer.help.back')}</Text>
      </TouchableOpacity>

      <Modal
        visible={Boolean(selectedUser)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedUser(null)}
      >
        <ProfileDataPopup user={selectedUser} onClose={() => setSelectedUser(null)} />
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: globals.colors.background },
  content: { padding: globals.spacing.md },
  title: {
    fontSize: globals.fontSize.lg,
    fontWeight: 'bold',
    color: globals.colors.text,
    marginBottom: globals.spacing.md,
  },
  spinner: { marginBottom: globals.spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: globals.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: globals.colors.border,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: globals.radius.full,
    backgroundColor: globals.colors.avatarPlaceholder,
    marginRight: globals.spacing.sm,
  },
  rowTitle: { fontSize: globals.fontSize.md, color: globals.colors.text },
  mutedText: { fontSize: globals.fontSize.sm, color: globals.colors.textMuted },
  errorText: { color: globals.colors.danger, fontSize: globals.fontSize.sm, marginBottom: globals.spacing.sm },
  infoText: { color: globals.colors.primary, fontSize: globals.fontSize.sm, marginBottom: globals.spacing.sm },
  selectButton: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.sm,
    paddingVertical: globals.spacing.xs,
    paddingHorizontal: globals.spacing.sm,
  },
  selectButtonText: { color: globals.colors.secondary, fontSize: globals.fontSize.sm, fontWeight: '600' },
  actionsCol: { gap: globals.spacing.xs, alignItems: 'flex-end' },
  completeButton: {
    backgroundColor: globals.colors.success ?? globals.colors.primary,
    borderRadius: globals.radius.sm,
    paddingVertical: globals.spacing.xs,
    paddingHorizontal: globals.spacing.sm,
  },
  backLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginVertical: globals.spacing.lg,
  },
});
