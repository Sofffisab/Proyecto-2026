// src/notifications/HelpRequestAlertProvider.js
//
// Spec section 9 — Push Notification "Tal necesita ayuda": fires when a
// user presses "Pedir Ayuda". Rendered as an in-app pop-up (not a
// full-screen takeover) with two actions: accept it (go straight to the
// Ayudar screen, spec's "Acción al abrir") or close it. It's mounted once
// near the root so it can appear no matter which trainer screen is open.

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../styles/globals';
import { useTranslation } from '../i18n/I18nContext';

const HelpRequestAlertContext = createContext({ showHelpRequest: () => {} });

export function HelpRequestAlertProvider({ children, onAccept }) {
  const { t } = useTranslation();
  const [pending, setPending] = useState(null);

  const showHelpRequest = useCallback((data) => {
    setPending(data);
  }, []);

  const close = useCallback(() => setPending(null), []);

  const accept = useCallback(() => {
    const data = pending;
    setPending(null);
    onAccept?.(data);
  }, [pending, onAccept]);

  const value = useMemo(() => ({ showHelpRequest }), [showHelpRequest]);

  return (
    <HelpRequestAlertContext.Provider value={value}>
      {children}
      <Modal visible={!!pending} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.title}>
              {t('pushNotifications.helpRequestTitle') || 'Someone needs help'}
            </Text>
            <Text style={styles.body}>
              {pending?.userName
                ? t('pushNotifications.helpRequestBody', { name: pending.userName }) ||
                  `${pending.userName} needs help`
                : t('pushNotifications.helpRequestBodyGeneric') || 'A member needs help'}
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.closeButton} onPress={close}>
                <Text style={styles.closeButtonText}>{t('common.close')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptButton} onPress={accept}>
                <Text style={styles.acceptButtonText}>
                  {t('pushNotifications.helpRequestAccept') || 'Go help'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </HelpRequestAlertContext.Provider>
  );
}

export function useHelpRequestAlert() {
  return useContext(HelpRequestAlertContext);
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: globals.colors.background,
    borderRadius: 16,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: globals.colors.text,
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    color: globals.colors.text,
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  closeButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  closeButtonText: {
    color: globals.colors.textMuted || globals.colors.text,
    fontWeight: '600',
  },
  acceptButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: globals.colors.primary,
    borderRadius: 10,
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
