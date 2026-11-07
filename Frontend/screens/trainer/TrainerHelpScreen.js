// Trainer "Ayudar" screen: the selected person on top and, below, the
// pop-up style card with their data (medical topics, the trainer's own notes
// and public notes) plus the "Ir a ayudar" button. Reached from the home list
// or from the help alert banner. Static (see mockData.js).
//
// Wiring notes for later: the button maps to PATCH /assistance/:id/assign
// (assistance.api#assignAssistance) and the notes to GET /users/:id/notes.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import ScreenBody from '../../components/trainer/ScreenBody';
import PersonRow from '../../components/trainer/PersonRow';

function DataSection({ title, items, emptyLabel }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.length === 0 ? (
        <Text style={styles.empty}>{emptyLabel}</Text>
      ) : (
        items.map((line) => (
          <View key={line} style={styles.bulletRow}>
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
  if (!person) return null;
  const firstName = person.name.split(' ')[0];
  const none = t('trainer.popups.profileData.none');

  return (
    <ScreenBody title={t('trainer.help.helpTitle')}>
      <PersonRow name={person.name} needsHelp={person.needsHelp} />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('trainer.popups.profileData.title')}</Text>

        <DataSection title={t('trainer.help.medicalTitle')} items={person.medical} emptyLabel={none} />
        <DataSection title={t('trainer.help.notesTitle')} items={person.notes} emptyLabel={none} />
        <DataSection title={t('trainer.help.publicNotesTitle')} items={person.publicNotes} emptyLabel={none} />

        <TouchableOpacity style={styles.cta} activeOpacity={0.85} accessibilityRole="button">
          <Text style={styles.ctaLabel}>{t('trainer.help.goHelp', { name: firstName })}</Text>
        </TouchableOpacity>
      </View>
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
  cta: {
    marginTop: globals.spacing.lg,
    alignItems: 'center',
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.full,
    paddingVertical: 14,
    ...globals.shadow.button,
  },
  ctaLabel: { color: '#fff', fontSize: globals.fontSize.md, fontWeight: '700' },
});
