// src/screens/trainer/HomeScreen.js
//
// Main Screen (Trainer) - spec section 9. Mostly a navigation hub (QR
// generation, History, Reports, Help are separate screens/modules), but
// two pieces of live data belong here:
//   - GET /users/me -> trainerProfile.availability, to show/toggle the
//     trainer's current AVAILABLE/BUSY status (used to prioritize "Pedir
//     Ayuda" assignment server-side, see gymEnforcement/assistance
//     services). Toggled via PATCH /assistance/trainer/availability
//     (assistance.api.js#setTrainerAvailability).
//   - GET /assistance/active -> pending assistance requests count, so the
//     trainer sees at a glance if someone needs help even before the
//     push notification (spec: 'Push Notification "Tal necesita ayuda"').

import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Switch } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import * as userApi from '../../api/services/user.api';
import * as assistanceApi from '../../api/services/assistance.api';

/**
 * @param {function} [onGenerateQR]
 * @param {function} [onGoToHistory]
 * @param {function} [onGoToReports]
 * @param {function} [onGoToHelp]
 * @param {function} [onGoToMachineConflicts]
 * @param {function} [onBack]
 */
export default function TrainerHomeScreen({
  onGenerateQR,
  onGoToHistory,
  onGoToReports,
  onGoToHelp,
  onGoToRoutineRequests,
  onGoToMachineConflicts,
  onGoToNotifications,
  onBack,
}) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [hadError, setHadError] = useState(false);
  const [available, setAvailable] = useState(true);
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [meResult, activeResult] = await Promise.allSettled([
      userApi.getMe(),
      assistanceApi.getActiveAssistance(),
    ]);

    let anyFailed = false;

    if (meResult.status === 'fulfilled') {
      setAvailable((meResult.value.data?.trainerProfile?.availability ?? 'AVAILABLE') === 'AVAILABLE');
    } else {
      anyFailed = true;
    }

    if (activeResult.status === 'fulfilled') {
      setPendingCount((activeResult.value.data ?? []).length);
    } else {
      anyFailed = true;
    }

    setHadError(anyFailed);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const handleToggleAvailability = async (nextValue) => {
    setAvailable(nextValue);
    setTogglingAvailability(true);
    try {
      await assistanceApi.setTrainerAvailability(nextValue ? 'AVAILABLE' : 'BUSY');
    } catch {
      // Revert on failure
      setAvailable(!nextValue);
    } finally {
      setTogglingAvailability(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {hadError && <Text style={styles.errorText}>{t('trainer.home.loadError')}</Text>}

      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>{t('trainer.home.availabilityTitle')}</Text>
          {loading || togglingAvailability ? (
            <ActivityIndicator color={globals.colors.primary} />
          ) : (
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>
                {available ? t('trainer.home.available') : t('trainer.home.busy')}
              </Text>
              <Switch value={available} onValueChange={handleToggleAvailability} />
            </View>
          )}
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>{t('trainer.home.pendingHelpTitle')}</Text>
          {loading ? (
            <ActivityIndicator color={globals.colors.primary} />
          ) : pendingCount === 0 ? (
            <Text style={styles.pendingEmpty}>{t('trainer.home.pendingHelpEmpty')}</Text>
          ) : (
            <Text style={styles.pendingCount}>
              {t('trainer.home.pendingHelpCount', { count: pendingCount })}
            </Text>
          )}
        </View>
      </View>

      <TouchableOpacity style={styles.navButton} onPress={onGenerateQR}>
        <Text style={styles.navButtonText}>{t('trainer.home.generateQR')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navButton} onPress={onGoToHistory}>
        <Text style={styles.navButtonText}>{t('trainer.home.history')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navButton} onPress={onGoToReports}>
        <Text style={styles.navButtonText}>{t('trainer.home.reports')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navButton} onPress={onGoToHelp}>
        <Text style={styles.navButtonText}>{t('trainer.home.help')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navButton} onPress={onGoToRoutineRequests}>
        <Text style={styles.navButtonText}>{t('trainer.home.routineRequests')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navButton} onPress={onGoToMachineConflicts}>
        <Text style={styles.navButtonText}>{t('trainer.home.machineConflicts')}</Text>
      </TouchableOpacity>

      {onGoToNotifications && (
        <TouchableOpacity style={styles.navButton} onPress={onGoToNotifications}>
          <Text style={styles.navButtonText}>{t('trainer.home.notifications')}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLink}>{t('trainer.home.back')}</Text>
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
  statusCard: {
    backgroundColor: globals.colors.sectionCard,
    borderRadius: globals.radius.lg,
    padding: globals.spacing.md,
    marginBottom: globals.spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: globals.spacing.sm,
  },
  statusLabel: {
    fontSize: globals.fontSize.md,
    fontWeight: '600',
    color: globals.colors.text,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchLabel: {
    marginRight: globals.spacing.sm,
    color: globals.colors.textMuted,
    fontSize: globals.fontSize.sm,
  },
  pendingCount: {
    color: globals.colors.primary,
    fontWeight: '700',
    fontSize: globals.fontSize.md,
  },
  pendingEmpty: {
    color: globals.colors.textMuted,
    fontSize: globals.fontSize.sm,
  },
  navButton: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.md,
    alignItems: 'center',
    marginBottom: globals.spacing.sm,
  },
  navButtonText: {
    color: globals.colors.text,
    fontSize: globals.fontSize.md,
    fontWeight: '600',
  },
  errorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    marginBottom: globals.spacing.md,
    textAlign: 'center',
  },
  backLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginVertical: globals.spacing.lg,
  },
});
