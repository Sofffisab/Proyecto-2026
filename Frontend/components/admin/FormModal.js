import React from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import AdminButton from './AdminButton';

/**
 * Bottom-sheet style modal for the small forms of the admin/trainer screens
 * (new account, add stock, edit prize, add note...).
 *
 * @param {boolean}  visible
 * @param {string}   title
 * @param {function} onClose
 * @param {function} onSubmit      - confirm button
 * @param {string}   [submitLabel]
 * @param {boolean}  [busy]        - disables the buttons while saving
 * @param {string}   [error]       - message shown above the buttons
 */
export default function FormModal({ visible, title, onClose, onSubmit, submitLabel, busy, error, children }) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={busy ? undefined : onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.body}>
            {children}
          </ScrollView>
          {!!error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.actions}>
            <AdminButton label={t('common.cancel')} onPress={onClose} disabled={busy} style={styles.action} />
            <AdminButton
              label={submitLabel || t('common.save')}
              variant="primary"
              onPress={onSubmit}
              disabled={busy}
              style={styles.action}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: globals.spacing.md },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,21,31,0.45)' },
  sheet: {
    backgroundColor: globals.colors.surface,
    borderRadius: globals.radius.lg,
    padding: globals.spacing.md,
    maxHeight: '88%',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  title: { fontSize: globals.fontSize.lg, fontWeight: '700', color: globals.colors.text, marginBottom: globals.spacing.md },
  body: { flexGrow: 0 },
  error: { color: globals.colors.danger, marginTop: globals.spacing.sm },
  actions: { flexDirection: 'row', gap: globals.spacing.sm, marginTop: globals.spacing.md },
  action: { flex: 1 },
});
