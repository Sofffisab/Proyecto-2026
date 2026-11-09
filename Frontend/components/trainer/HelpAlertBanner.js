import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import { HandIcon, CloseIcon } from './TrainerIcons';

/**
 * "X necesita ayuda" alert (mockup: green box on "Pantalla ayudar").
 *
 * Shown by the trainer's home screen for the member who has been waiting the
 * longest after pressing "Pedir Ayuda" (see assistance.api#requestAssistance
 * on the member side); "Ir a ayudar" takes the trainer to the "Ayudar" screen.
 *
 * @param {string}   name
 * @param {function} [onGoHelp]  - "Ir a ayudar"
 * @param {function} [onDismiss] - closes the banner
 */
export default function HelpAlertBanner({ name, onGoHelp, onDismiss }) {
  const { t } = useTranslation();
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <View style={styles.iconCircle}>
        <HandIcon color="#fff" size={22} />
      </View>
      <View style={styles.texts}>
        <Text style={styles.title}>{t('trainer.alert.title', { name })}</Text>
        <TouchableOpacity style={styles.action} onPress={onGoHelp} activeOpacity={0.85}>
          <Text style={styles.actionLabel}>{t('trainer.alert.goHelp')}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        onPress={onDismiss}
        hitSlop={10}
        style={styles.close}
        accessibilityRole="button"
        accessibilityLabel={t('trainer.alert.dismiss')}
      >
        <CloseIcon color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.lg,
    padding: globals.spacing.md,
    marginBottom: globals.spacing.md,
    ...globals.shadow.button,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, marginHorizontal: globals.spacing.md },
  title: { color: '#fff', fontSize: globals.fontSize.md, fontWeight: '700' },
  action: {
    alignSelf: 'flex-start',
    marginTop: globals.spacing.sm,
    backgroundColor: '#fff',
    borderRadius: globals.radius.full,
    paddingVertical: 6,
    paddingHorizontal: globals.spacing.md,
  },
  actionLabel: { color: globals.colors.primary, fontSize: globals.fontSize.sm, fontWeight: '700' },
  close: { alignSelf: 'flex-start', padding: 2 },
});
