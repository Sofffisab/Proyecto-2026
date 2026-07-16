// src/screens/trainer/popups/ProfileDataPopup.js
//
// Pop-up with profile data clicked from the Help screen - spec section 12.
// "Al hacer click, abre un pop-up con más datos: temas médicos, sus notas,
// notas públicas, etc."
//
// Medical conditions / level / objectives come from the `student` prop
// (already fetched by HelpScreen from GET /gym/priority-assistance, see
// gym.service.js#getPriorityAssistanceList). Notes are fetched here from
// GET /users/:id/notes (note.api.js), which the Backend already scopes so
// a trainer only ever receives their own notes (public or private) plus
// other trainers' PUBLIC notes — split client-side by trainerId into
// "my notes" vs "public notes from other trainers".

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import globals from '../../../styles/globals';
import { useTranslation } from '../../../i18n/I18nContext';
import { useAuth } from '../../../context/AuthContext';
import * as noteApi from '../../../api/services/note.api';

const LEVEL_LABELS = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
};

function formatObjectives(objectives) {
  if (!Array.isArray(objectives) || objectives.length === 0) return null;
  return objectives
    .map((o) => (typeof o === 'string' ? o : o?.type ?? o?.goal))
    .filter(Boolean)
    .join(', ');
}

/**
 * @param {object} student - { id, firstName, lastName, medicalConditions,
 *   trainingLevel, objectives } as returned inside
 *   GET /gym/priority-assistance's `.user`.
 * @param {function} [onClose] - Close button.
 */
export default function ProfileDataPopup({ student, onClose }) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [newNote, setNewNote] = useState('');
  const [makePublic, setMakePublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const loadNotes = useCallback(async () => {
    if (!student?.id) return;
    setLoading(true);
    setLoadError(false);
    try {
      const res = await noteApi.getNotes(student.id);
      setNotes(res.data ?? []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [student?.id]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleAddNote = async () => {
    if (!newNote.trim() || !student?.id) return;
    setSaving(true);
    setSaveError(null);
    try {
      await noteApi.createNote(student.id, {
        note: newNote.trim(),
        visibility: makePublic ? 'PUBLIC' : 'PRIVATE',
      });
      setNewNote('');
      setMakePublic(false);
      await loadNotes();
    } catch (err) {
      setSaveError(err.message || t('trainer.popups.profileData.addNoteError'));
    } finally {
      setSaving(false);
    }
  };

  const myNotes = notes.filter((n) => n.trainerId === user?.id);
  const otherPublicNotes = notes.filter((n) => n.trainerId !== user?.id);

  const objectivesText = formatObjectives(student?.objectives);
  const medicalConditions = Array.isArray(student?.medicalConditions)
    ? student.medicalConditions
    : [];

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <ScrollView>
          <Text style={styles.title}>{t('trainer.popups.profileData.title')}</Text>
          {student && (
            <Text style={styles.name}>
              {student.firstName} {student.lastName}
            </Text>
          )}

          <Text style={styles.sectionLabel}>{t('trainer.popups.profileData.medicalConditionsTitle')}</Text>
          <Text style={styles.sectionValue}>
            {medicalConditions.length > 0
              ? medicalConditions.join(', ')
              : t('trainer.popups.profileData.medicalConditionsEmpty')}
          </Text>

          {student?.trainingLevel && (
            <>
              <Text style={styles.sectionLabel}>{t('trainer.popups.profileData.levelTitle')}</Text>
              <Text style={styles.sectionValue}>
                {LEVEL_LABELS[student.trainingLevel] ?? student.trainingLevel}
              </Text>
            </>
          )}

          {objectivesText && (
            <>
              <Text style={styles.sectionLabel}>{t('trainer.popups.profileData.objectivesTitle')}</Text>
              <Text style={styles.sectionValue}>{objectivesText}</Text>
            </>
          )}

          <Text style={styles.sectionLabel}>{t('trainer.popups.profileData.myNotesTitle')}</Text>
          {loading ? (
            <ActivityIndicator color={globals.colors.primary} />
          ) : loadError ? (
            <Text style={styles.errorText}>{t('trainer.popups.profileData.loadError')}</Text>
          ) : myNotes.length === 0 ? (
            <Text style={styles.sectionValue}>{t('trainer.popups.profileData.myNotesEmpty')}</Text>
          ) : (
            myNotes.map((n) => (
              <Text key={n.id} style={styles.noteText}>
                • {n.note}
              </Text>
            ))
          )}

          <Text style={styles.sectionLabel}>{t('trainer.popups.profileData.publicNotesTitle')}</Text>
          {!loading && !loadError && otherPublicNotes.length === 0 ? (
            <Text style={styles.sectionValue}>{t('trainer.popups.profileData.publicNotesEmpty')}</Text>
          ) : (
            otherPublicNotes.map((n) => (
              <Text key={n.id} style={styles.noteText}>
                • {n.note}{' '}
                {n.trainer && (
                  <Text style={styles.noteAuthor}>
                    ({n.trainer.firstName} {n.trainer.lastName})
                  </Text>
                )}
              </Text>
            ))
          )}

          <TextInput
            style={styles.input}
            placeholder={t('trainer.popups.profileData.addNotePlaceholder')}
            value={newNote}
            onChangeText={setNewNote}
            multiline
          />

          <TouchableOpacity style={styles.checkboxRow} onPress={() => setMakePublic((v) => !v)}>
            <View style={[styles.checkbox, makePublic && styles.checkboxChecked]} />
            <Text style={styles.checkboxLabel}>{t('trainer.popups.profileData.addNotePublic')}</Text>
          </TouchableOpacity>

          {saveError && <Text style={styles.errorText}>{saveError}</Text>}

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleAddNote}
            disabled={saving || !newNote.trim()}
          >
            {saving ? (
              <ActivityIndicator color={globals.colors.secondary} />
            ) : (
              <Text style={styles.submitButtonText}>{t('trainer.popups.profileData.addNoteSubmit')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>

        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeLink}>{t('trainer.popups.profileData.close')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '88%',
    maxHeight: '80%',
    backgroundColor: globals.colors.background,
    borderRadius: globals.radius.lg,
    padding: globals.spacing.lg,
  },
  title: {
    fontSize: globals.fontSize.lg,
    fontWeight: 'bold',
    color: globals.colors.text,
    marginBottom: globals.spacing.xs,
    textAlign: 'center',
  },
  name: {
    fontSize: globals.fontSize.md,
    color: globals.colors.textMuted,
    textAlign: 'center',
    marginBottom: globals.spacing.md,
  },
  sectionLabel: {
    fontSize: globals.fontSize.sm,
    fontWeight: '700',
    color: globals.colors.text,
    marginTop: globals.spacing.sm,
  },
  sectionValue: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    marginBottom: globals.spacing.xs,
  },
  noteText: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.text,
    marginBottom: globals.spacing.xs,
  },
  noteAuthor: {
    color: globals.colors.textMuted,
    fontStyle: 'italic',
  },
  input: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    padding: globals.spacing.sm,
    minHeight: 50,
    textAlignVertical: 'top',
    color: globals.colors.text,
    marginTop: globals.spacing.md,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: globals.spacing.sm,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.sm,
    marginRight: globals.spacing.sm,
  },
  checkboxChecked: {
    backgroundColor: globals.colors.primary,
    borderColor: globals.colors.primary,
  },
  checkboxLabel: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.text,
  },
  errorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    marginTop: globals.spacing.xs,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.sm,
    alignItems: 'center',
    marginTop: globals.spacing.sm,
  },
  submitButtonText: {
    color: globals.colors.secondary,
    fontWeight: '600',
  },
  closeLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginTop: globals.spacing.md,
  },
});
