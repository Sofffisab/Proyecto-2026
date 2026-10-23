// src/screens/user/CameraScreen.js
//
// Plain camera preview opened from the camera buttons of the free-mode and
// step-by-step screens. Asks for the camera permission the first time.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * @param {function} [onBack]
 */
export default function CameraScreen({ onBack }) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();

  const closeButton = (
    <TouchableOpacity style={styles.closeButton} onPress={onBack}>
      <Text style={styles.closeButtonLabel}>{t('common.close')}</Text>
    </TouchableOpacity>
  );

  // Permission not loaded yet.
  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>{t('user.routines.cameraPermissionRequired')}</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonLabel}>{t('common.grantCameraAccess')}</Text>
        </TouchableOpacity>
        {closeButton}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back" />
      {closeButton}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  camera: { ...StyleSheet.absoluteFillObject },
  message: { color: '#fff', textAlign: 'center', marginBottom: globals.spacing.md, paddingHorizontal: globals.spacing.lg },
  permissionButton: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.md,
    paddingHorizontal: globals.spacing.lg,
  },
  permissionButtonLabel: { color: '#fff', fontWeight: '600' },
  closeButton: {
    position: 'absolute',
    top: 48,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.sm,
    paddingHorizontal: globals.spacing.md,
  },
  closeButtonLabel: { color: '#fff', fontWeight: '600' },
});
