import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Español / English switch. Used in the user's Settings and in the trainer's
 * and admin's profile tab. Changing it re-renders the whole app at once.
 */
export default function LanguageSelector({ style }) {
  const { t, language, setLanguage, availableLanguages } = useTranslation();

  return (
    <View style={style}>
      <Text style={styles.title}>{t('common.language')}</Text>
      <View style={styles.row}>
        {availableLanguages.map((l) => {
          const on = l.code === language;
          return (
            <TouchableOpacity
              key={l.code}
              style={[styles.option, on && styles.optionOn]}
              onPress={() => setLanguage(l.code)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.label, on && styles.labelOn]}>{l.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: globals.fontSize.md, fontWeight: '700', color: globals.colors.text, marginBottom: globals.spacing.sm },
  row: { flexDirection: 'row', gap: globals.spacing.sm },
  option: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: globals.radius.full,
    borderWidth: 1.5,
    borderColor: globals.colors.primary,
    backgroundColor: globals.colors.surface,
  },
  optionOn: { backgroundColor: globals.colors.primary },
  label: { fontSize: globals.fontSize.md, fontWeight: '700', color: globals.colors.primary },
  labelOn: { color: '#fff' },
});
