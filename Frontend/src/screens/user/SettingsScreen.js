import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import globals from '../../styles/globals';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Settings & customization Screen (User) - spec section 7.
 * If it's the first time, the system redirects here and doesn't allow
 * leaving until everything is completed. Required fields (except email,
 * which isn't editable): medical conditions, date of birth, exact address, etc.
 * Each row is an accordion: tap the row to reveal the input.
 *
 * @param {string}   [email] - Session email, not editable.
 * @param {function} [onSave] - Saves the data to the DB.
 * @param {function} [onBack]
 */
const FIELDS = [
  { key: 'medicalConditions', labelKey: 'user.settings.medicalConditions' },
  { key: 'dateOfBirth', labelKey: 'user.settings.dateOfBirth' },
  { key: 'exactAddress', labelKey: 'user.settings.exactAddress' },
];

const PREFERENCES = [
  { key: 'noTrainerHelp', labelKey: 'user.settings.noTrainerHelp' },
  { key: 'noMachineApp', labelKey: 'user.settings.noMachineApp' },
];

export default function SettingsScreen({ email = '', onSave, onBack }) {
  const { t } = useTranslation();
  const [openField, setOpenField] = useState(null);
  const [values, setValues] = useState({});
  const [preferences, setPreferences] = useState({});

  const toggle = (key) =>
    setOpenField((prev) => (prev === key ? null : key));

  const handleChange = (key, text) =>
    setValues((prev) => ({ ...prev, [key]: text }));

  const togglePreference = (key) =>
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Header pageTitle={t('user.settings.title')} subtitle={t('user.settings.subtitle')} />

      {/* Email: not editable */}
      <View style={styles.fieldBlock}>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>{t('user.settings.mail')}</Text>
        </View>
        <View style={styles.inputWrapper}>
          <TextInput style={styles.input} value={email} editable={false} />
        </View>
      </View>

      {/* Required fields in accordion format */}
      {FIELDS.map(({ key, labelKey }) => {
        const isOpen = openField === key;
        const label = t(labelKey);
        return (
          <View key={key} style={styles.fieldBlock}>
            <TouchableOpacity
              style={styles.fieldRow}
              onPress={() => toggle(key)}
              activeOpacity={0.8}
            >
              <Text style={styles.fieldLabel}>{label}</Text>
              <Text style={[styles.fieldArrow, isOpen && styles.fieldArrowOpen]}>{'>'}</Text>
            </TouchableOpacity>

            {isOpen && (
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder={t('user.settings.inputPlaceholder', { field: label.toLowerCase() })}
                  placeholderTextColor={globals.colors.textMuted}
                  value={values[key] ?? ''}
                  onChangeText={(text) => handleChange(key, text)}
                />
              </View>
            )}
          </View>
        );
      })}

      {/* Preferences */}
      <Text style={styles.sectionTitle}>{t('user.settings.preferencesTitle')}</Text>
      {PREFERENCES.map(({ key, labelKey }) => (
        <TouchableOpacity
          key={key}
          style={styles.preferenceRow}
          onPress={() => togglePreference(key)}
        >
          <Text style={styles.fieldLabel}>{t(labelKey)}</Text>
          <Text style={styles.checkbox}>{preferences[key] ? '☑' : '☐'}</Text>
        </TouchableOpacity>
      ))}

      <View style={styles.buttonGroup}>
        <Button label={t('user.settings.save')} onPress={onSave} />
        <Button label={t('user.settings.back')} onPress={onBack} variant="secondary" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: globals.colors.backgroundAlt,
  },
  content: {
    paddingBottom: globals.spacing.xl,
  },
  sectionTitle: {
    fontSize: globals.fontSize.lg,
    fontWeight: 'bold',
    color: globals.colors.text,
    paddingHorizontal: globals.spacing.md,
    marginTop: globals.spacing.lg,
    marginBottom: globals.spacing.xs,
  },
  fieldBlock: {
    backgroundColor: globals.colors.secondary,
    marginHorizontal: globals.spacing.md,
    marginTop: globals.spacing.xs,
    borderRadius: globals.radius.md,
    overflow: 'hidden',
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: globals.spacing.md,
    paddingVertical: globals.spacing.md,
  },
  fieldLabel: {
    flex: 1,
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
  },
  fieldArrow: {
    fontSize: globals.fontSize.xl,
    color: globals.colors.textMuted,
  },
  fieldArrowOpen: {
    transform: [{ rotate: '90deg' }],
  },
  inputWrapper: {
    paddingHorizontal: globals.spacing.md,
    paddingBottom: globals.spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    padding: globals.spacing.sm,
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
    backgroundColor: globals.colors.background,
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: globals.colors.secondary,
    marginHorizontal: globals.spacing.md,
    marginTop: globals.spacing.xs,
    paddingHorizontal: globals.spacing.md,
    paddingVertical: globals.spacing.md,
    borderRadius: globals.radius.md,
  },
  checkbox: {
    fontSize: globals.fontSize.lg,
    color: globals.colors.primary,
  },
  buttonGroup: {
    paddingHorizontal: globals.spacing.md,
    marginTop: globals.spacing.lg,
  },
});
