// src/screens/user/popups/CustomExercisePopup.js
//
// "Crear ejercicio propio": the person names the exercise, describes it and
// optionally adds a photo from their gallery.

import React, { useState } from 'react';
import { View, Text, Image, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import globals from '../../../styles/globals';
import { useTranslation } from '../../../i18n/I18nContext';

const NAME_MAX_LENGTH = 40;
const DESCRIPTION_MAX_LENGTH = 200;

/**
 * @param {function} onSave - ({ name, description, imageUri }) => void
 * @param {function} onClose
 */
export default function CustomExercisePopup({ onSave, onClose }) {
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [error, setError] = useState(null);

  // The photo is kept as a base64 data URI so it survives app restarts on
  // web too (blob/cache URIs don't).
  const handlePickImage = async () => {
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.4,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setImageUri(asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : asset.uri);
    } catch {
      setError(t('user.routines.popups.custom.imageError'));
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      setError(t('user.routines.popups.custom.nameRequired'));
      return;
    }
    onSave({ name: name.trim(), description: description.trim(), imageUri });
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>{t('user.routines.popups.custom.title')}</Text>

        <TouchableOpacity style={styles.photoBox} onPress={handlePickImage}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.photo} />
          ) : (
            <Text style={styles.photoText}>{t('user.routines.popups.custom.addPhoto')}</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>{t('user.routines.popups.custom.nameLabel')}</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} maxLength={NAME_MAX_LENGTH} />

        <Text style={styles.label}>{t('user.routines.popups.custom.descriptionLabel')}</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={description}
          onChangeText={setDescription}
          maxLength={DESCRIPTION_MAX_LENGTH}
          multiline
        />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity style={styles.submitButton} onPress={handleSave}>
          <Text style={styles.submitButtonText}>{t('common.save')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeLink}>{t('common.cancel')}</Text>
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
    width: '85%',
    backgroundColor: globals.colors.background,
    borderRadius: globals.radius.lg,
    padding: globals.spacing.lg,
  },
  title: {
    fontSize: globals.fontSize.lg,
    fontWeight: 'bold',
    color: globals.colors.text,
    marginBottom: globals.spacing.md,
    textAlign: 'center',
  },
  photoBox: {
    width: 96,
    height: 96,
    alignSelf: 'center',
    borderRadius: globals.radius.md,
    borderWidth: 1,
    borderColor: globals.colors.border,
    backgroundColor: globals.colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: globals.spacing.md,
  },
  photo: { width: '100%', height: '100%' },
  photoText: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: globals.spacing.sm,
  },
  label: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textSecondary,
    marginBottom: globals.spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    padding: globals.spacing.sm,
    color: globals.colors.text,
    marginBottom: globals.spacing.md,
  },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  errorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    marginBottom: globals.spacing.sm,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.md,
    alignItems: 'center',
    marginBottom: globals.spacing.sm,
  },
  submitButtonText: { color: '#fff', fontWeight: '600' },
  closeLink: { textAlign: 'center', color: globals.colors.textMuted },
});
