// src/screens/shared/GenerateQRScreen.js
//
// "Generar nuevo QR" — spec sections 9 (Trainer) and 13 (Admin): "Permite
// elegir si es máquina, entrada, salida o cuál es, y lo regenera de forma
// manual (independiente a la regeneración automática diaria)."
//
// Shared between Trainer and Admin because the underlying capability is
// the same resource (Backend/src/controllers/qr.controller.js); only the
// permissions differ (see Backend/src/routes/index.js "QR MANAGEMENT
// ROUTES" and Backend/src/middlewares/role.middleware.js):
//   - regenerate an existing machine's QR -> ADMIN or TRAINER
//   - list all machines (GET /qr/gym-access), create a new machine,
//     deactivate a machine                -> ADMIN only
//
// Backend reality worth being explicit about (verified in
// Backend/src/services/verification.service.js#processScan and
// Backend/prisma/schema.prisma): only MACHINE QRs are persisted,
// token-based entities that can be rotated. Entry/exit QRs are validated
// with payload `{ type: "ENTRY_EXIT" }` and no token/signature check at
// all, so there is no row, no route, and nothing to "regenerate" for
// them — the daily/manual rotation concept from the spec only applies to
// machines. The Entry/Exit option below is kept (per the spec's wording)
// but explains this instead of faking a network call.

import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import globals from '../../styles/globals';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import { useTranslation } from '../../i18n/I18nContext';
import * as qrManagementApi from '../../api/services/qrManagement.api';

const QR_TYPES = { MACHINE: 'MACHINE', ENTRY_EXIT: 'ENTRY_EXIT' };

/**
 * @param {'ADMIN'|'TRAINER'} role
 * @param {function} [onBack]
 */
export default function GenerateQRScreen({ role, onBack }) {
  const { t } = useTranslation();
  const isAdmin = role === 'ADMIN';

  const [qrType, setQrType] = useState(QR_TYPES.MACHINE);

  // ADMIN-only: full machine list, refetched on focus (see GET /qr/gym-access).
  const [machines, setMachines] = useState([]);
  const [machinesLoading, setMachinesLoading] = useState(isAdmin);
  const loadMachines = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setMachinesLoading(true);
      const { data } = await qrManagementApi.getGymQRCodes();
      setMachines(data ?? []);
    } catch {
      // Best-effort: an empty list still lets Admin create a new machine.
    } finally {
      setMachinesLoading(false);
    }
  }, [isAdmin]);

  useFocusEffect(
    useCallback(() => {
      loadMachines();
    }, [loadMachines])
  );

  // Selected machine to regenerate. ADMIN picks from the list above;
  // TRAINER has no list endpoint available (GET /qr/gym-access is
  // ADMIN-only), so they type the machine id they're standing next to
  // instead — same PATCH /qr/machines/:id/regenerate call either way.
  const [selectedMachineId, setSelectedMachineId] = useState(null);
  const [manualMachineId, setManualMachineId] = useState('');

  const [newMachineName, setNewMachineName] = useState('');
  const [creating, setCreating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState(null);

  // Result of the last create/regenerate call, rendered as an actual QR
  // code below (so it can be printed and stuck on the machine). The
  // payload shape matches what Backend/src/services/verification.service.js
  // #processScan expects for a MACHINE scan: { type, machineId, qrToken }.
  const [resultQR, setResultQR] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message }

  const buildMachinePayload = (machineId, qrToken) =>
    JSON.stringify({ type: QR_TYPES.MACHINE, machineId, qrToken });

  const handleCreateMachine = async () => {
    if (!newMachineName.trim()) return;
    try {
      setCreating(true);
      setFeedback(null);
      const { data } = await qrManagementApi.createMachine(newMachineName.trim());
      setResultQR({ machineId: data.id, qrToken: data.qrToken, name: data.name });
      setNewMachineName('');
      setFeedback({ type: 'success', message: t('qrGeneration.createSuccess') });
      loadMachines();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || t('qrGeneration.createError') });
    } finally {
      setCreating(false);
    }
  };

  const handleRegenerate = async (machineId, machineName) => {
    if (!machineId) return;
    try {
      setRegenerating(true);
      setFeedback(null);
      // regenerateMachineQR (service layer) responds with { machineId, token }
      // — note the field is named "token" there, not "qrToken"; normalized
      // here so the rest of the screen only ever deals with "qrToken".
      const { data } = await qrManagementApi.regenerateMachine(machineId);
      setResultQR({ machineId: data.machineId, qrToken: data.token, name: machineName });
      setFeedback({ type: 'success', message: t('qrGeneration.regenerateSuccess') });
      loadMachines();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || t('qrGeneration.regenerateError') });
    } finally {
      setRegenerating(false);
    }
  };

  const handleDeactivate = async (machineId) => {
    try {
      setDeactivatingId(machineId);
      setFeedback(null);
      await qrManagementApi.deactivateMachine(machineId);
      if (resultQR?.machineId === machineId) setResultQR(null);
      setFeedback({ type: 'success', message: t('qrGeneration.deactivateSuccess') });
      loadMachines();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || t('qrGeneration.deactivateError') });
    } finally {
      setDeactivatingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <Header pageTitle={t('qrGeneration.title')} subtitle={t('qrGeneration.subtitle')} />

      <ScrollView style={styles.content}>
        {/* Type selector: máquina / entrada / salida, per the spec wording.
            Entry and Exit share the same explanation (see file header), so
            they're grouped as a single "ENTRY_EXIT" option here. */}
        <View style={styles.typeRow}>
          <Button
            label={t('qrGeneration.typeMachine')}
            variant={qrType === QR_TYPES.MACHINE ? 'primary' : 'secondary'}
            onPress={() => {
              setQrType(QR_TYPES.MACHINE);
              setFeedback(null);
            }}
          />
          <Button
            label={t('qrGeneration.typeEntryExit')}
            variant={qrType === QR_TYPES.ENTRY_EXIT ? 'primary' : 'secondary'}
            onPress={() => {
              setQrType(QR_TYPES.ENTRY_EXIT);
              setFeedback(null);
              setResultQR(null);
            }}
          />
        </View>

        {feedback && (
          <Text style={feedback.type === 'error' ? styles.errorText : styles.successText}>
            {feedback.message}
          </Text>
        )}

        {qrType === QR_TYPES.ENTRY_EXIT && (
          <Card
            title={t('qrGeneration.entryExitTitle')}
            content={t('qrGeneration.entryExitExplanation')}
          />
        )}

        {qrType === QR_TYPES.MACHINE && (
          <>
            {isAdmin && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{t('qrGeneration.createNewMachine')}</Text>
                <TextInput
                  style={styles.input}
                  value={newMachineName}
                  onChangeText={setNewMachineName}
                  placeholder={t('qrGeneration.machineNamePlaceholder')}
                  placeholderTextColor={globals.colors.textMuted}
                />
                <Button
                  label={creating ? t('qrGeneration.creating') : t('qrGeneration.createButton')}
                  onPress={handleCreateMachine}
                  disabled={creating || !newMachineName.trim()}
                />
              </View>
            )}

            {isAdmin ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{t('qrGeneration.selectMachine')}</Text>
                {machinesLoading ? (
                  <ActivityIndicator color={globals.colors.primary} />
                ) : machines.length === 0 ? (
                  <Text style={styles.emptyText}>{t('qrGeneration.noMachines')}</Text>
                ) : (
                  machines.map((machine) => (
                    <View key={machine.id} style={styles.machineRow}>
                      <Text
                        style={[
                          styles.machineName,
                          selectedMachineId === machine.id && styles.machineNameSelected,
                        ]}
                        onPress={() => setSelectedMachineId(machine.id)}
                      >
                        {machine.name}
                      </Text>
                      <View style={styles.machineActions}>
                        <Button
                          label={
                            regenerating && selectedMachineId === machine.id
                              ? t('qrGeneration.regenerating')
                              : t('qrGeneration.regenerateButton')
                          }
                          variant="secondary"
                          onPress={() => {
                            setSelectedMachineId(machine.id);
                            handleRegenerate(machine.id, machine.name);
                          }}
                          disabled={regenerating}
                        />
                        <Button
                          label={
                            deactivatingId === machine.id
                              ? t('qrGeneration.deactivating')
                              : t('qrGeneration.deactivateButton')
                          }
                          variant="danger"
                          onPress={() => handleDeactivate(machine.id)}
                          disabled={deactivatingId === machine.id}
                        />
                      </View>
                    </View>
                  ))
                )}
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{t('qrGeneration.trainerManualIdLabel')}</Text>
                <Text style={styles.hintText}>{t('qrGeneration.trainerManualIdHint')}</Text>
                <TextInput
                  style={styles.input}
                  value={manualMachineId}
                  onChangeText={setManualMachineId}
                  placeholder={t('qrGeneration.machineIdPlaceholder')}
                  placeholderTextColor={globals.colors.textMuted}
                  autoCapitalize="none"
                />
                <Button
                  label={regenerating ? t('qrGeneration.regenerating') : t('qrGeneration.regenerateButton')}
                  onPress={() => handleRegenerate(manualMachineId.trim(), null)}
                  disabled={regenerating || !manualMachineId.trim()}
                />
              </View>
            )}

            {resultQR && (
              <View style={styles.qrResult}>
                <Text style={styles.sectionLabel}>
                  {resultQR.name
                    ? t('qrGeneration.qrReadyFor', { name: resultQR.name })
                    : t('qrGeneration.qrReady')}
                </Text>
                <View style={styles.qrCodeWrapper}>
                  <QRCode value={buildMachinePayload(resultQR.machineId, resultQR.qrToken)} size={200} />
                </View>
                <Text style={styles.hintText}>{t('qrGeneration.qrPrintHint')}</Text>
              </View>
            )}
          </>
        )}

        <Text style={styles.backLink} onPress={onBack}>{t('common.back')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: globals.colors.background,
  },
  content: {
    flex: 1,
    padding: globals.spacing.md,
  },
  typeRow: {
    flexDirection: 'row',
    gap: globals.spacing.sm,
    marginBottom: globals.spacing.md,
  },
  section: {
    marginTop: globals.spacing.lg,
  },
  sectionLabel: {
    fontSize: globals.fontSize.md,
    fontWeight: '600',
    color: globals.colors.text,
    marginBottom: globals.spacing.sm,
  },
  hintText: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    marginBottom: globals.spacing.sm,
  },
  emptyText: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
  },
  input: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    padding: globals.spacing.md,
    color: globals.colors.text,
    marginBottom: globals.spacing.sm,
  },
  machineRow: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    padding: globals.spacing.md,
    marginBottom: globals.spacing.sm,
  },
  machineName: {
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
    marginBottom: globals.spacing.sm,
  },
  machineNameSelected: {
    color: globals.colors.primary,
    fontWeight: 'bold',
  },
  machineActions: {
    flexDirection: 'row',
    gap: globals.spacing.sm,
  },
  qrResult: {
    marginTop: globals.spacing.lg,
    alignItems: 'center',
  },
  qrCodeWrapper: {
    backgroundColor: '#ffffff',
    padding: globals.spacing.md,
    borderRadius: globals.radius.md,
    marginVertical: globals.spacing.sm,
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
  backLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginVertical: globals.spacing.lg,
  },
});
