import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
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
 * which isn't editable): medical conditions, date of birth, exact address.
 * Each row is an accordion: tap the row to reveal the input.
 *
 * Field <-> Backend mapping (see Backend/src/validators/user.schemas.js
 * #updateUserSchema and #updateSettingsSchema):
 *   medicalConditions -> medicalConditions: string[] (comma-separated here)
 *   dateOfBirth        -> birthday: ISO datetime string
 *   exactAddress       -> deliveryAddress: string
 *   noTrainerHelp      -> disableAssistance: boolean
 *   noMachineApp       -> machineTrackingOptOut: boolean
 *
 * @param {string}   [email] - Session email, not editable.
 * @param {number|null} [age] - Derived server-side from birthday (never
 *   editable directly — see Backend/src/utils/age.js#calculateAge).
 * @param {object}   [initialValues] - Pre-fill from the current user, so
 *   re-opening Settings later shows what's already saved.
 * @param {function} onSave - async ({ medicalConditions, birthday,
 *   deliveryAddress, disableAssistance, machineTrackingOptOut }) => void
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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function SettingsScreen({ email = '', age = null, initialValues = {}, onSave, onBack }) {
  const { t } = useTranslation();
  const [openField, setOpenField] = useState(null);
  const [values, setValues] = useState({
    medicalConditions: initialValues.medicalConditions ?? '',
    dateOfBirth: initialValues.dateOfBirth ?? '',
    exactAddress: initialValues.exactAddress ?? '',
  });
  const [preferences, setPreferences] = useState({
    noTrainerHelp: Boolean(initialValues.disableAssistance),
    noMachineApp: Boolean(initialValues.machineTrackingOptOut),
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const toggle = (key) => setOpenField((prev) => (prev === key ? null : key));

  const handleChange = (key, text) => setValues((prev) => ({ ...prev, [key]: text }));

  const togglePreference = (key) => setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleSave = async () => {
    const { medicalConditions, dateOfBirth, exactAddress } = values;

    if (!medicalConditions.trim() || !dateOfBirth.trim() || !exactAddress.trim()) {
      setError(t('user.settings.errorSaving'));
      return;
    }
    if (!DATE_RE.test(dateOfBirth.trim())) {
      setError(t('user.settings.invalidDate'));
      return;
    }

    const birthdayIso = new Date(`${dateOfBirth.trim()}T00:00:00.000Z`);
    if (Number.isNaN(birthdayIso.getTime())) {
      setError(t('user.settings.invalidDate'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        medicalConditions: medicalConditions
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        birthday: birthdayIso.toISOString(),
        deliveryAddress: exactAddress.trim(),
        disableAssistance: preferences.noTrainerHelp,
        machineTrackingOptOut: preferences.noMachineApp,
      });
    } catch (err) {
      setError(err.message || t('user.settings.errorSaving'));
    } finally {
      setSaving(false);
    }
  };

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
              <Text style={styles.fieldValuePreview} numberOfLines={1}>
                {values[key] ? values[key] : ''}
              </Text>
              <Text style={[styles.fieldArrow, isOpen && styles.fieldArrowOpen]}>{'>'}</Text>
            </TouchableOpacity>

            {isOpen && (
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder={
                    key === 'dateOfBirth'
                      ? t('user.settings.dateOfBirthPlaceholder')
                      : t('user.settings.inputPlaceholder', { field: label.toLowerCase() })
                  }
                  placeholderTextColor={globals.colors.textMuted}
                  value={values[key] ?? ''}
                  onChangeText={(text) => handleChange(key, text)}
                  editable={!saving}
                />
                {key === 'dateOfBirth' && age != null && (
                  <Text style={styles.ageHint}>{t('user.settings.currentAge', { age })}</Text>
                )}
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
          disabled={saving}
        >
          <Text style={styles.fieldLabel}>{t(labelKey)}</Text>
          <Text style={styles.checkbox}>{preferences[key] ? '☑' : '☐'}</Text>
        </TouchableOpacity>
      ))}

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.buttonGroup}>
        {saving ? (
          <ActivityIndicator color={globals.colors.primary} style={{ marginVertical: globals.spacing.md }} />
        ) : (
          <Button label={t('user.settings.save')} onPress={handleSave} />
        )}
        <Button label={t('user.settings.back')} onPress={onBack} variant="secondary" disabled={saving} />
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
  fieldValuePreview: {
    flex: 1,
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    textAlign: 'right',
    marginRight: globals.spacing.xs,
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
  ageHint: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    marginTop: globals.spacing.xs,
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
  errorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    textAlign: 'center',
    marginTop: globals.spacing.md,
    marginHorizontal: globals.spacing.md,
  },
  buttonGroup: {
    paddingHorizontal: globals.spacing.md,
    marginTop: globals.spacing.lg,
    gap: globals.spacing.sm,
  },
});
