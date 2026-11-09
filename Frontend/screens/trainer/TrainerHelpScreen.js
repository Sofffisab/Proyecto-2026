// Trainer "Ayudar" screen: the selected person on top and, below, the card
// with their data (medical topics, the trainer's own notes and public notes)
// plus the "Ir a ayudar" button. Reached from the home list or from the help
// alert banner.
// Data: GET /gym/people/:id. "Ir a ayudar" takes the member's pending request
// (or starts a help on the spot) and "Marcar ayuda como completada" closes it.

import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import useLiveLoad from '../../hooks/useLiveLoad';
import * as trainerApi from '../../apiClient/services/trainer.api';
import ScreenBody from '../../components/trainer/ScreenBody';
import PersonRow from '../../components/trainer/PersonRow';
import FormField from '../../components/admin/FormField';
import StateView from '../../components/common/StateView';

function DataSection({ title, items, emptyLabel }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.length === 0 ? (
        <Text style={styles.empty}>{emptyLabel}</Text>
      ) : (
        items.map((line, i) => (
          <View key={`${i}-${line}`} style={styles.bulletRow}>
            <View style={styles.bullet} />
            <Text style={styles.item}>{line}</Text>
          </View>
        ))
      )}
    </View>
  );
}

export default function TrainerHelpScreen({ person }) {
  const { t } = useTranslation();
  const loader = useCallback(async () => (await trainerApi.getPersonInGym(person.id)).data, [person?.id]);
  const { data, loading, error, reload } = useLiveLoad(loader, ['help']);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'ok' | 'error', text }
  const [note, setNote] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  const run = useCallback(
    async (action, okText) => {
      setBusy(true);
      setMessage(null);
      try {
        await action();
        if (okText) setMessage({ type: 'ok', text: okText });
        await reload({ silent: true });
      } catch (err) {
        setMessage({ type: 'error', text: err.message });
      } finally {
        setBusy(false);
      }
    },
    [reload]
  );

  if (!person) return null;
  const name = data?.name ?? person.name;
  const firstName = name.split(' ')[0];
  const none = t('trainer.popups.profileData.none');

  const startHelp = () => run(() => trainerApi.startHelp(person.id), t('trainer.help.assigned'));
  const completeHelp = () => run(() => trainerApi.completeHelp(data.activeAssistanceId), t('trainer.help.completeSuccess'));
  const saveNote = () =>
    run(async () => {
      await trainerApi.createNote(person.id, note.trim(), isPublic ? 'PUBLIC' : 'PRIVATE');
      setNote('');
      setIsPublic(false);
    });

  const mine = (data?.notes ?? []).filter((n) => n.mine).map((n) => n.note);
  const publicNotes = (data?.notes ?? [])
    .filter((n) => !n.mine && n.visibility === 'PUBLIC')
    .map((n) => (n.author ? `${n.note} — ${n.author}` : n.note));

  return (
    <ScreenBody title={t('trainer.help.helpTitle')}>
      <PersonRow name={name} needsHelp={data?.needsHelp ?? person.needsHelp} />

      <StateView loading={loading} error={error} onRetry={reload}>
        {data && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('trainer.popups.profileData.title')}</Text>

            <DataSection title={t('trainer.help.medicalTitle')} items={data.medical} emptyLabel={none} />
            <DataSection title={t('trainer.help.notesTitle')} items={mine} emptyLabel={none} />
            <DataSection title={t('trainer.help.publicNotesTitle')} items={publicNotes} emptyLabel={none} />

            <View style={styles.section}>
              <FormField
                value={note}
                onChangeText={setNote}
                placeholder={t('trainer.popups.profileData.newNotePlaceholder')}
                multiline
                autoCapitalize="sentences"
              />
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t('trainer.popups.profileData.makePublic')}</Text>
                <Switch
                  value={isPublic}
                  onValueChange={setIsPublic}
                  trackColor={{ false: globals.colors.secondary, true: globals.colors.primary }}
                  thumbColor="#fff"
                />
              </View>
              <TouchableOpacity
                onPress={saveNote}
                disabled={busy || !note.trim()}
                style={[styles.secondary, (busy || !note.trim()) && styles.disabled]}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryLabel}>{t('trainer.help.addNote')}</Text>
              </TouchableOpacity>
            </View>

            {!!message && (
              <Text style={[styles.message, message.type === 'error' && styles.messageError]}>{message.text}</Text>
            )}

            {data.activeAssistanceId ? (
              <TouchableOpacity style={[styles.cta, busy && styles.disabled]} onPress={completeHelp} disabled={busy} activeOpacity={0.85} accessibilityRole="button">
                <Text style={styles.ctaLabel}>{t('trainer.help.completeHelp')}</Text>
              </TouchableOpacity>
            ) : data.takenByOther ? (
              <Text style={styles.empty}>{t('trainer.help.takenByOther')}</Text>
            ) : (
              <TouchableOpacity style={[styles.cta, busy && styles.disabled]} onPress={startHelp} disabled={busy} activeOpacity={0.85} accessibilityRole="button">
                <Text style={styles.ctaLabel}>{t('trainer.help.goHelp', { name: firstName })}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </StateView>
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: globals.colors.surface,
    borderRadius: globals.radius.lg,
    borderWidth: 1,
    borderColor: globals.colors.surfaceBorder,
    padding: globals.spacing.md,
    ...globals.shadow.card,
  },
  cardTitle: {
    fontSize: globals.fontSize.lg,
    fontWeight: '700',
    color: globals.colors.text,
    marginBottom: globals.spacing.xs,
  },
  section: { marginTop: globals.spacing.md },
  sectionTitle: {
    fontSize: globals.fontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: globals.colors.accent,
    marginBottom: globals.spacing.xs,
  },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: globals.colors.primary,
    marginTop: 8,
    marginRight: globals.spacing.sm,
  },
  item: { flex: 1, fontSize: globals.fontSize.md, color: globals.colors.text, lineHeight: 22 },
  empty: { fontSize: globals.fontSize.md, color: globals.colors.textSecondary },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: globals.spacing.sm },
  switchLabel: { flex: 1, fontSize: globals.fontSize.md, color: globals.colors.text },
  secondary: {
    alignItems: 'center',
    borderRadius: globals.radius.full,
    borderWidth: 1.5,
    borderColor: globals.colors.primary,
    paddingVertical: 10,
  },
  secondaryLabel: { color: globals.colors.primary, fontWeight: '700', fontSize: globals.fontSize.md },
  message: { marginTop: globals.spacing.md, color: globals.colors.primary, fontSize: globals.fontSize.md },
  messageError: { color: globals.colors.danger },
  cta: {
    marginTop: globals.spacing.lg,
    alignItems: 'center',
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.full,
    paddingVertical: 14,
    ...globals.shadow.button,
  },
  ctaLabel: { color: '#fff', fontSize: globals.fontSize.md, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
