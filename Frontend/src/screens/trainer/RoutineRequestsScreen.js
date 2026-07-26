// src/screens/trainer/RoutineRequestsScreen.js
//
// Routine Requests Screen (Trainer). Closes a gap in the spec: "Solicitudes
// de rutina: falta pantalla de Trainer para aceptar/rechazar/completar."
//
// Backend wiring:
//   GET   /routines/requests/all           -> requests assigned to (or
//                                              unassigned/pending for) this
//                                              trainer (routine.api.js)
//   PATCH /routines/requests/:id/accept    -> accept a PENDING request
//   PATCH /routines/requests/:id/reject    -> reject a PENDING request
//   PATCH /routines/requests/:id/complete  -> mark an ACCEPTED request as
//                                              delivered/completed

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import * as routineApi from '../../api/services/routine.api';

/**
 * @param {function} [onBack]
 */
export default function RoutineRequestsScreen({ onBack }) {
  const { t } = useTranslation();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await routineApi.getMyRoutineRequests();
      setRequests(data ?? []);
    } catch (err) {
      setError(err.message || t('trainer.routineRequests.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const personName = (u) => `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || u?.email || '—';

  const statusLabel = (status) => {
    switch (status) {
      case 'PENDING':
        return t('trainer.routineRequests.statusPending');
      case 'ACCEPTED':
        return t('trainer.routineRequests.statusAccepted');
      case 'REJECTED':
        return t('trainer.routineRequests.statusRejected');
      case 'COMPLETED':
        return t('trainer.routineRequests.statusCompleted');
      default:
        return status;
    }
  };

  const runAction = async (request, action) => {
    setBusyId(request.id);
    setActionMessage(null);
    try {
      let data;
      if (action === 'accept') ({ data } = await routineApi.acceptRoutineRequest(request.id));
      else if (action === 'reject') ({ data } = await routineApi.rejectRoutineRequest(request.id));
      else ({ data } = await routineApi.completeRoutineRequest(request.id));

      setRequests((prev) => prev.map((r) => (r.id === request.id ? { ...r, ...data } : r)));
    } catch (err) {
      setActionMessage(err.message || t('trainer.routineRequests.actionError'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('trainer.routineRequests.title')}</Text>

      {loading && <ActivityIndicator color={globals.colors.primary} style={styles.spinner} />}
      {error && <Text style={styles.errorText}>{error}</Text>}
      {actionMessage && <Text style={styles.errorText}>{actionMessage}</Text>}

      {!loading && requests.length === 0 && (
        <Text style={styles.mutedText}>{t('trainer.routineRequests.empty')}</Text>
      )}

      {requests.map((r) => (
        <View key={r.id} style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>
              {t('trainer.routineRequests.requestedBy', { name: personName(r.user) })}
            </Text>
            <Text style={styles.mutedText}>{statusLabel(r.status)}</Text>
          </View>

          {r.status === 'PENDING' && (
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => runAction(r, 'accept')}
                disabled={busyId === r.id}
              >
                {busyId === r.id ? (
                  <ActivityIndicator color={globals.colors.secondary} size="small" />
                ) : (
                  <Text style={styles.smallButtonText}>{t('trainer.routineRequests.accept')}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rejectButton}
                onPress={() => runAction(r, 'reject')}
                disabled={busyId === r.id}
              >
                <Text style={styles.smallButtonText}>{t('trainer.routineRequests.reject')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {r.status === 'ACCEPTED' && (
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => runAction(r, 'complete')}
              disabled={busyId === r.id}
            >
              {busyId === r.id ? (
                <ActivityIndicator color={globals.colors.secondary} size="small" />
              ) : (
                <Text style={styles.smallButtonText}>{t('trainer.routineRequests.complete')}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      ))}

      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLink}>{t('trainer.routineRequests.back')}</Text>
      </TouchableOpacity>
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
    gap: globals.spacing.sm,
  },
  rowInfo: { flex: 1, gap: 2 },
  rowTitle: { fontSize: globals.fontSize.md, color: globals.colors.text },
  mutedText: { fontSize: globals.fontSize.sm, color: globals.colors.textMuted },
  errorText: { color: globals.colors.danger, fontSize: globals.fontSize.sm, marginBottom: globals.spacing.sm },
  actionsRow: { flexDirection: 'row', gap: globals.spacing.xs },
  acceptButton: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.sm,
    paddingVertical: globals.spacing.xs,
    paddingHorizontal: globals.spacing.sm,
  },
  rejectButton: {
    backgroundColor: globals.colors.danger,
    borderRadius: globals.radius.sm,
    paddingVertical: globals.spacing.xs,
    paddingHorizontal: globals.spacing.sm,
  },
  smallButtonText: { color: globals.colors.secondary, fontSize: globals.fontSize.sm, fontWeight: '600' },
  backLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginVertical: globals.spacing.lg,
  },
});
