// src/screens/trainer/MachineConflictsScreen.js
//
// Machine Conflicts Screen (Trainer). Closes a gap flagged in the spec
// review: "Cola de conflictos de máquina para trainers
// (GET/PATCH /qr/machine-conflicts)" had no screen wired up.
//
// Backend wiring:
//   GET   /qr/machine-conflicts             -> pending conflicts, each with
//                                               machine + both users
//                                               (machineConflict.api.js)
//   PATCH /qr/machine-conflicts/:id/resolve -> trainer verifies in person
//                                               who was actually on the
//                                               machine (machineConflict.api.js)
//
// The trainer is shown as a verification queue, not an auto-resolution:
// the Backend already auto-detects the conflict from overlapping QR scans
// (verification.service.js), this screen is only the "someone has to
// physically check who's really there" step, matching how the Backend
// models a MachineConflict (unresolved until a trainer confirms it).

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import * as machineConflictApi from '../../api/services/machineConflict.api';

/**
 * @param {function} [onBack]
 */
export default function MachineConflictsScreen({ onBack }) {
  const { t } = useTranslation();

  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await machineConflictApi.getPendingConflicts();
      setConflicts(data ?? []);
    } catch (err) {
      setError(err.message || t('trainer.machineConflicts.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const personName = (u) => `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || u?.id || '—';

  const handleResolve = async (conflict, resolution) => {
    setBusyId(conflict.id);
    setActionMessage(null);
    try {
      await machineConflictApi.resolveConflict(conflict.id, resolution);
      setConflicts((prev) => prev.filter((c) => c.id !== conflict.id));
      setActionMessage(t('trainer.machineConflicts.resolveSuccess'));
    } catch (err) {
      setActionMessage(err.message || t('trainer.machineConflicts.resolveError'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('trainer.machineConflicts.title')}</Text>

      {loading && <ActivityIndicator color={globals.colors.primary} style={styles.spinner} />}
      {error && <Text style={styles.errorText}>{error}</Text>}
      {actionMessage && <Text style={styles.infoText}>{actionMessage}</Text>}

      {!loading && conflicts.length === 0 && (
        <Text style={styles.mutedText}>{t('trainer.machineConflicts.empty')}</Text>
      )}

      {conflicts.map((conflict) => (
        <View key={conflict.id} style={styles.card}>
          <Text style={styles.machineName}>{conflict.machine?.name ?? conflict.machineId}</Text>
          <Text style={styles.mutedText}>
            {t('trainer.machineConflicts.detectedAt', {
              date: conflict.detectedAt ? new Date(conflict.detectedAt).toLocaleString() : '—',
            })}
          </Text>

          <View style={styles.usersRow}>
            <Text style={styles.userLabel}>
              {t('trainer.machineConflicts.firstUser', { name: personName(conflict.firstUser) })}
            </Text>
            <Text style={styles.userLabel}>
              {t('trainer.machineConflicts.secondUser', { name: personName(conflict.secondUser) })}
            </Text>
          </View>

          <Text style={styles.sectionLabel}>{t('trainer.machineConflicts.whoIsPresent')}</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleResolve(conflict, 'BOTH_PRESENT')}
              disabled={busyId === conflict.id}
            >
              <Text style={styles.actionButtonText}>{t('trainer.machineConflicts.bothPresent')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleResolve(conflict, 'ONLY_FIRST')}
              disabled={busyId === conflict.id}
            >
              <Text style={styles.actionButtonText}>{t('trainer.machineConflicts.onlyFirst')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleResolve(conflict, 'ONLY_SECOND')}
              disabled={busyId === conflict.id}
            >
              <Text style={styles.actionButtonText}>{t('trainer.machineConflicts.onlySecond')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.dangerButton]}
              onPress={() => handleResolve(conflict, 'NEITHER_PRESENT')}
              disabled={busyId === conflict.id}
            >
              {busyId === conflict.id ? (
                <ActivityIndicator color={globals.colors.secondary} size="small" />
              ) : (
                <Text style={styles.actionButtonText}>{t('trainer.machineConflicts.neitherPresent')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLink}>{t('trainer.machineConflicts.back')}</Text>
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
  card: {
    backgroundColor: globals.colors.sectionCard,
    borderRadius: globals.radius.md,
    padding: globals.spacing.md,
    marginBottom: globals.spacing.md,
  },
  machineName: { fontSize: globals.fontSize.md, fontWeight: '700', color: globals.colors.text },
  mutedText: { fontSize: globals.fontSize.sm, color: globals.colors.textMuted },
  errorText: { color: globals.colors.danger, fontSize: globals.fontSize.sm, marginBottom: globals.spacing.sm },
  infoText: { color: globals.colors.primary, fontSize: globals.fontSize.sm, marginBottom: globals.spacing.sm },
  usersRow: { marginTop: globals.spacing.sm, gap: 2 },
  userLabel: { fontSize: globals.fontSize.md, color: globals.colors.text },
  sectionLabel: {
    fontSize: globals.fontSize.sm,
    fontWeight: '600',
    color: globals.colors.text,
    marginTop: globals.spacing.md,
    marginBottom: globals.spacing.xs,
  },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: globals.spacing.xs },
  actionButton: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.sm,
    paddingVertical: globals.spacing.xs,
    paddingHorizontal: globals.spacing.sm,
  },
  dangerButton: { backgroundColor: globals.colors.danger },
  actionButtonText: { color: globals.colors.secondary, fontSize: globals.fontSize.sm, fontWeight: '600' },
  backLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginVertical: globals.spacing.lg,
  },
});
