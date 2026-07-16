// src/screens/trainer/popups/ProfileDataPopup.js
//
// Pop-up with profile data clicked from the Help screen - spec section 12.
// Shows: medical conditions, notes, public notes, etc.
//
// Backend wiring:
//   Medical conditions come from the row already fetched by the Help
//   screen via GET /gym/priority-assistance (gym.api.js), not a second
//   fetch — per-user medicalConditions are otherwise stripped for
//   non-owners (see Backend/src/services/user.service.js#getById).
//   Notes: GET/POST/PUT/DELETE /users/:id/notes (note.api.js). Private
//   notes are only editable by the trainer who wrote them; PUBLIC notes
//   from other trainers show up read-only.

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Switch } from 'react-native';
import globals from '../../../styles/globals';
import { useTranslation } from '../../../i18n/I18nContext';
import { useAuth } from '../../../context/AuthContext';
import * as noteApi from '../../../api/services/note.api';

/**
 * @param {object} [user] - The selected gym member (from the priority list row).
 * @param {function} [onClose] - Close button.
 */
export default function ProfileDataPopup({ user, onClose }) {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newNote, setNewNote] = useState('');
  const [newNotePublic, setNewNotePublic] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await noteApi.getNotes(user.id);
      setNotes(data ?? []);
    } catch (err) {
      setError(err.message || t('trainer.popups.profileData.loadError'));
    } finally {
      setLoading(false);
    }
  }, [user?.id, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddNote = async () => {
    if (!newNote.trim() || !user?.id) return;
    setSaving(true);
    setError(null);
    try {
      await noteApi.createNote(user.id, {
        note: newNote.trim(),
        visibility: newNotePublic ? 'PUBLIC' : 'PRIVATE',
      });
      setNewNote('');
      setNewNotePublic(false);
      await load();
    } catch (err) {
      setError(err.message || t('trainer.popups.profileData.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!user?.id) return;
    try {
      await noteApi.deleteNote(user.id, noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err) {
      setError(err.message || t('trainer.popups.profileData.saveError'));
    }
  };

  const myNotes = notes.filter((n) => n.visibility === 'PRIVATE' && n.trainerId === currentUser?.id);
  const publicNotes = notes.filter((n) => n.visibility === 'PUBLIC');

  return (
    <View style={styles.overlay}>
      <ScrollView style={styles.card} contentContainerStyle={styles.cardContent}>
        <Text style={styles.title}>{t('trainer.popups.profileData.title')}</Text>
        <Text style={styles.subtitle}>
          {`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.id}
        </Text>

        <Text style={styles.sectionLabel}>{t('trainer.popups.profileData.medicalConditions')}</Text>
        <Text style={styles.bodyText}>
          {user?.medicalConditions || t('trainer.popups.profileData.none')}
        </Text>

        {error && <Text style={styles.errorText}>{error}</Text>}
        {loading && <ActivityIndicator color={globals.colors.primary} />}

        <Text style={styles.sectionLabel}>{t('trainer.popups.profileData.notes')}</Text>
        {!loading && myNotes.length === 0 && (
          <Text style={styles.mutedText}>{t('trainer.popups.profileData.none')}</Text>
        )}
        {myNotes.map((n) => (
          <View key={n.id} style={styles.noteRow}>
            <Text style={styles.bodyText}>{n.note}</Text>
            <TouchableOpacity onPress={() => handleDeleteNote(n.id)}>
              <Text style={styles.deleteLink}>{t('trainer.popups.profileData.delete')}</Text>
            </TouchableOpacity>
          </View>
        ))}

        <Text style={styles.sectionLabel}>{t('trainer.popups.profileData.publicNotes')}</Text>
        {!loading && publicNotes.length === 0 && (
          <Text style={styles.mutedText}>{t('trainer.popups.profileData.none')}</Text>
        )}
        {publicNotes.map((n) => (
          <Text key={n.id} style={styles.bodyText}>{n.note}</Text>
        ))}

        <TextInput
          style={styles.input}
          placeholder={t('trainer.popups.profileData.newNotePlaceholder')}
          value={newNote}
          onChangeText={setNewNote}
          multiline
        />
        <View style={styles.publicToggleRow}>
          <Text style={styles.mutedText}>{t('trainer.popups.profileData.makePublic')}</Text>
          <Switch value={newNotePublic} onValueChange={setNewNotePublic} />
        </View>
        <TouchableOpacity style={styles.saveButton} onPress={handleAddNote} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={globals.colors.secondary} size="small" />
          ) : (
            <Text style={styles.saveButtonText}>{t('common.save')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>{t('trainer.popups.profileData.close')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: globals.spacing.md,
  },
  card: {
    backgroundColor: globals.colors.background,
    borderRadius: globals.radius.lg,
    maxHeight: '85%',
  },
  cardContent: { padding: globals.spacing.md },
  title: { fontSize: globals.fontSize.lg, fontWeight: 'bold', color: globals.colors.text },
  subtitle: { fontSize: globals.fontSize.md, color: globals.colors.textMuted, marginBottom: globals.spacing.md },
  sectionLabel: {
    fontSize: globals.fontSize.md,
    fontWeight: '600',
    color: globals.colors.text,
    marginTop: globals.spacing.md,
    marginBottom: globals.spacing.xs,
  },
  bodyText: { fontSize: globals.fontSize.md, color: globals.colors.text },
  mutedText: { fontSize: globals.fontSize.sm, color: globals.colors.textMuted },
  errorText: { color: globals.colors.danger, fontSize: globals.fontSize.sm, marginTop: globals.spacing.sm },
  noteRow: {
    marginBottom: globals.spacing.xs,
    paddingBottom: globals.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: globals.colors.border,
  },
  deleteLink: { color: globals.colors.danger, fontSize: globals.fontSize.sm },
  input: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    padding: globals.spacing.sm,
    minHeight: 60,
    textAlignVertical: 'top',
    color: globals.colors.text,
    marginTop: globals.spacing.sm,
  },
  publicToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: globals.spacing.xs,
  },
  saveButton: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.sm,
    alignItems: 'center',
    marginTop: globals.spacing.sm,
  },
  saveButtonText: { color: globals.colors.secondary, fontWeight: '600' },
  closeButton: { marginTop: globals.spacing.md, alignItems: 'center' },
  closeButtonText: { color: globals.colors.textMuted },
});
