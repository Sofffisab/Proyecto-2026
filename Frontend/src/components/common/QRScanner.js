// src/components/common/QRScanner.js
//
// Reusable camera-based QR scanner, built on expo-camera's CameraView
// (SDK 51, "expo-camera": "~15.0.16" — free, first-party Expo module, no
// extra native config beyond the CAMERA permission already declared in
// app.json / AndroidManifest.xml).
//
// Used anywhere the spec calls for "Botón Cámara para escanear QR" (User
// Home, spec section 3) or "Generar nuevo QR" review flows — this
// component only handles reading a code and reporting the raw string back
// via onScanned; callers decide what the payload means (see qr.api.js).

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * @param {function} onScanned - called once with the raw scanned string
 *                                (e.g. `data` from a QR barcode event).
 * @param {function} [onClose] - optional close/cancel handler shown above the camera.
 */
export default function QRScanner({ onScanned, onClose }) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  // Guards against firing onScanned multiple times per frame while the
  // camera keeps detecting the same code before the caller navigates away
  // or closes the scanner.
  const [locked, setLocked] = useState(false);

  const handleBarcodeScanned = useCallback(
    ({ data }) => {
      if (locked || !data) return;
      setLocked(true);
      onScanned(data);
    },
    [locked, onScanned]
  );

  // Permission not yet requested/granted.
  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>{t('common.cameraPermissionRequired')}</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonLabel}>{t('common.grantCameraAccess')}</Text>
        </TouchableOpacity>
        {onClose && (
          <Text style={styles.closeLink} onPress={onClose}>{t('common.close')}</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={locked ? undefined : handleBarcodeScanned}
      />
      {onClose && (
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonLabel}>{t('common.close')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  message: {
    color: globals.colors.background,
    textAlign: 'center',
    padding: globals.spacing.lg,
  },
  permissionButton: {
    alignSelf: 'center',
    backgroundColor: globals.colors.primary,
    paddingVertical: globals.spacing.md,
    paddingHorizontal: globals.spacing.lg,
    borderRadius: globals.radius.md,
  },
  permissionButtonLabel: {
    color: globals.colors.secondary,
    fontWeight: '600',
  },
  closeLink: {
    color: globals.colors.background,
    textAlign: 'center',
    marginTop: globals.spacing.lg,
  },
  closeButton: {
    position: 'absolute',
    top: globals.spacing.lg,
    right: globals.spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: globals.spacing.sm,
    paddingHorizontal: globals.spacing.md,
    borderRadius: globals.radius.md,
  },
  closeButtonLabel: {
    color: globals.colors.background,
    fontWeight: '600',
  },
});
