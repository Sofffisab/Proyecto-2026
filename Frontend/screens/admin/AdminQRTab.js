// "Maletín" tab (ADMIN): the gym's static Entry/Exit QR + every active
// machine with its own QR, all rendered on screen so they can be scanned
// straight from the published web app (or printed).
//
// Payloads match Backend/src/services/verification.service.js#processScan:
//   entry/exit -> { type: 'ENTRY_EXIT' }                 (static, no token)
//   machine    -> { type: 'MACHINE', machineId, qrToken } (token rotates)

import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import globals from '../../styles/globals';
import Button from '../../components/common/Button';
import { useTranslation } from '../../i18n/I18nContext';
import * as qrManagementApi from '../../apiClient/services/qrManagement.api';

export const buildEntryExitPayload = () => JSON.stringify({ type: 'ENTRY_EXIT' });
export const buildMachinePayload = (machineId, qrToken) =>
  JSON.stringify({ type: 'MACHINE', machineId, qrToken });

export default function AdminQRTab({ onMachinesLoaded }) {
  const { t } = useTranslation();
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newName, setNewName] = useState('');
  const [busyId, setBusyId] = useState(null); // machine being regenerated / deactivated, or 'create'
  const [feedback, setFeedback] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await qrManagementApi.getGymQRCodes();
      setMachines(data ?? []);
      onMachinesLoaded?.(data ?? []);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || t('admin.qr.loadError') });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onMachinesLoaded, t]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const run = async (id, fn, okKey, errKey) => {
    try {
      setBusyId(id);
      setFeedback(null);
      await fn();
      setFeedback({ type: 'success', message: t(okKey) });
      await load();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || t(errKey) });
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    await run('create', () => qrManagementApi.createMachine(name), 'admin.qr.createSuccess', 'qrGeneration.createError');
    setNewName('');
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <Text style={styles.title}>{t('admin.qr.title')}</Text>

      {/* ---------- Static Entry / Exit QR ---------- */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('qrGeneration.entryExitQrLabel')}</Text>
        <View style={styles.qrWrapper}>
          <QRCode value={buildEntryExitPayload()} size={220} />
        </View>
        <Text style={styles.hint}>{t('qrGeneration.entryExitQrHint')}</Text>
      </View>

      {feedback && (
        <Text style={feedback.type === 'error' ? styles.error : styles.success}>{feedback.message}</Text>
      )}

      {/* ---------- Create machine ---------- */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('qrGeneration.createNewMachine')}</Text>
        <TextInput
          style={styles.input}
          value={newName}
          onChangeText={setNewName}
          placeholder={t('qrGeneration.machineNamePlaceholder')}
          placeholderTextColor={globals.colors.textMuted}
        />
        <Button
          label={busyId === 'create' ? t('qrGeneration.creating') : t('qrGeneration.createButton')}
          onPress={handleCreate}
          disabled={busyId === 'create' || !newName.trim()}
        />
      </View>

      {/* ---------- Machines list ---------- */}
      <Text style={styles.sectionTitle}>{t('admin.qr.machinesTitle')}</Text>
      {loading ? (
        <ActivityIndicator color={globals.colors.primary} style={{ marginTop: globals.spacing.lg }} />
      ) : machines.length === 0 ? (
        <Text style={styles.hint}>{t('qrGeneration.noMachines')}</Text>
      ) : (
        machines.map((m) => (
          <View key={m.id} style={styles.card}>
            <Text style={styles.cardTitle}>{m.name}</Text>
            <View style={styles.qrWrapper}>
              <QRCode value={buildMachinePayload(m.id, m.qrToken)} size={180} />
            </View>
            <View style={styles.actions}>
              <Button
                label={busyId === m.id ? t('qrGeneration.regenerating') : t('qrGeneration.regenerateButton')}
                variant="secondary"
                disabled={busyId === m.id}
                onPress={() => run(m.id, () => qrManagementApi.regenerateMachine(m.id), 'qrGeneration.regenerateSuccess', 'qrGeneration.regenerateError')}
              />
              <Button
                label={busyId === m.id ? t('qrGeneration.deactivating') : t('qrGeneration.deactivateButton')}
                variant="danger"
                disabled={busyId === m.id}
                onPress={() => run(m.id, () => qrManagementApi.deactivateMachine(m.id), 'qrGeneration.deactivateSuccess', 'qrGeneration.deactivateError')}
              />
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: globals.spacing.md, paddingBottom: globals.spacing.xl },
  title: { fontSize: globals.fontSize.xl, fontWeight: 'bold', color: globals.colors.text, marginBottom: globals.spacing.md },
  sectionTitle: { fontSize: globals.fontSize.lg, fontWeight: '600', color: globals.colors.text, marginTop: globals.spacing.md, marginBottom: globals.spacing.sm },
  card: {
    backgroundColor: globals.colors.surface,
    borderRadius: globals.radius.lg,
    borderWidth: 1,
    borderColor: globals.colors.surfaceBorder,
    padding: globals.spacing.md,
    marginBottom: globals.spacing.md,
    alignItems: 'center',
    ...globals.shadow.card,
  },
  cardTitle: { fontSize: globals.fontSize.md, fontWeight: '600', color: globals.colors.text, alignSelf: 'flex-start' },
  qrWrapper: { backgroundColor: '#fff', padding: globals.spacing.md, borderRadius: globals.radius.md, marginVertical: globals.spacing.md },
  hint: { fontSize: globals.fontSize.sm, color: globals.colors.textMuted, textAlign: 'center' },
  input: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    padding: globals.spacing.md,
    marginTop: globals.spacing.sm,
    color: globals.colors.text,
  },
  actions: { alignSelf: 'stretch', flexDirection: 'row', gap: globals.spacing.sm, justifyContent: 'center' },
  error: { color: globals.colors.danger, fontSize: globals.fontSize.sm, textAlign: 'center', marginBottom: globals.spacing.sm },
  success: { color: globals.colors.primary, fontSize: globals.fontSize.sm, textAlign: 'center', marginBottom: globals.spacing.sm },
});
