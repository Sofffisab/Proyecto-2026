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
import QRCode from 'react-native-qrcode-svg';
import globals from '../../styles/globals';
import Button from '../../components/common/Button';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Edit Profile / Settings & customization Screen (User) - spec section 7.
 * If it's the first time, the system redirects here and doesn't allow
 * leaving until everything is completed. Required fields (except email,
 * which isn't editable): medical conditions, date of birth, exact address.
 * Each row is an accordion: tap the row to reveal the input.
 *
 * Visual spec (per the "Editar perfil" mockup): a top bar with a back
 * chevron, the "Editar perfil" title and a "Guardar" link; an avatar; then
 * accordion rows for name / email / birthday / sex / experience level /
 * main goal, followed by the pre-existing required fields, preferences,
 * change-password, and a personal QR code. There is no self-service
 * "delete account" here on purpose — only an ADMIN can delete/deactivate
 * an account (see Backend/src/routes/index.js "PATCH /users/:id/status",
 * ADMIN-only).
 *
 * Field <-> Backend mapping (see Backend/src/validators/user.schemas.js
 * #updateUserSchema):
 *   firstName / lastName -> firstName / lastName: string
 *   gender              -> gender: "MALE"|"FEMALE"|"OTHER"|"PREFER_NOT_TO_SAY"
 *   trainingLevel       -> trainingLevel: ExperienceLevel (same 3 options as Onboarding)
 *   mainGoal            -> objectives: MainGoal[] (edited here as a single value, like Onboarding)
 *   medicalConditions   -> medicalConditions: string[] (comma-separated here)
 *   dateOfBirth         -> birthday: ISO datetime string
 *   exactAddress        -> deliveryAddress: string
 *   noTrainerHelp       -> disableAssistance: boolean
 *   noMachineApp        -> machineTrackingOptOut: boolean
 *
 * The QR code shown here is a client-side "member badge" built from the
 * user's own id — it's for gym staff to look someone up by eye/camera, and
 * is NOT wired into the machine/entry-exit scan flow (see
 * Backend/src/services/verification.service.js#processScan, which only
 * understands MACHINE and ENTRY_EXIT payloads). Scanning it elsewhere in
 * the app won't do anything.
 *
 * @param {string}   [firstName]
 * @param {string}   [lastName]
 * @param {string}   [email] - Session email, not editable.
 * @param {string}   [userId] - Encoded into the personal QR code.
 * @param {number|null} [age] - Derived server-side from birthday (never
 *   editable directly — see Backend/src/utils/age.js#calculateAge).
 * @param {object}   [initialValues] - Pre-fill from the current user, so
 *   re-opening Settings later shows what's already saved.
 * @param {function} onSave - async (patch) => void — patch may include any
 *   of: firstName, lastName, gender, trainingLevel, objectives,
 *   medicalConditions, birthday, deliveryAddress, disableAssistance,
 *   machineTrackingOptOut.
 * @param {function} [onChangePassword]
 * @param {function} [onBack]
 */
const GENDER_OPTIONS = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];
const LEVEL_OPTIONS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const GOAL_OPTIONS = ['LOSE_WEIGHT', 'GAIN_MUSCLE', 'IMPROVE_HEALTH', 'INCREASE_ENDURANCE'];

const FIELDS = [
  { key: 'medicalConditions', labelKey: 'user.settings.medicalConditions' },
  { key: 'exactAddress', labelKey: 'user.settings.exactAddress' },
];

const PREFERENCES = [
  { key: 'noTrainerHelp', labelKey: 'user.settings.noTrainerHelp' },
  { key: 'noMachineApp', labelKey: 'user.settings.noMachineApp' },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function initialsFor(firstName, lastName) {
  const a = (firstName || '').trim().charAt(0);
  const b = (lastName || '').trim().charAt(0);
  return (a + b).toUpperCase() || '?';
}

/** A row that expands into pill-style single-select options. */
function PillSelectRow({ label, options, optionLabel, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.fieldBlock}>
      <TouchableOpacity style={styles.fieldRow} onPress={() => setOpen((p) => !p)} activeOpacity={0.8}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValuePreview} numberOfLines={1}>
          {value ? optionLabel(value) : ''}
        </Text>
        <Text style={[styles.fieldArrow, open && styles.fieldArrowOpen]}>{'>'}</Text>
      </TouchableOpacity>

      {open && (
        <View style={styles.pillWrap}>
          {options.map((opt) => {
            const selected = value === opt;
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.pill, selected && styles.pillSelected]}
                onPress={() => onChange(opt)}
                disabled={disabled}
              >
                <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                  {optionLabel(opt)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function SettingsScreen({
  firstName = '',
  lastName = '',
  email = '',
  userId = '',
  age = null,
  initialValues = {},
  onSave,
  onChangePassword,
  onBack,
}) {
  const { t } = useTranslation();
  const [openField, setOpenField] = useState(null);

  const [firstNameValue, setFirstNameValue] = useState(firstName);
  const [lastNameValue, setLastNameValue] = useState(lastName);
  const [gender, setGender] = useState(initialValues.gender ?? null);
  const [trainingLevel, setTrainingLevel] = useState(initialValues.trainingLevel ?? null);
  const [mainGoal, setMainGoal] = useState(initialValues.mainGoal ?? null);

  const initialDate = initialValues.dateOfBirth ?? ''; // "YYYY-MM-DD" or ''
  const [year, setYear] = useState(initialDate ? initialDate.slice(0, 4) : '');
  const [month, setMonth] = useState(initialDate ? initialDate.slice(5, 7) : '');
  const [day, setDay] = useState(initialDate ? initialDate.slice(8, 10) : '');

  const [values, setValues] = useState({
    medicalConditions: initialValues.medicalConditions ?? '',
    exactAddress: initialValues.exactAddress ?? '',
  });
  const [preferences, setPreferences] = useState({
    noTrainerHelp: Boolean(initialValues.disableAssistance),
    noMachineApp: Boolean(initialValues.machineTrackingOptOut),
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // "Cambiar contraseña" (PATCH /users/me/password) - separate mini-form,
  // independent from the profile fields above.
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const toggle = (key) => setOpenField((prev) => (prev === key ? null : key));

  const handleChange = (key, text) => setValues((prev) => ({ ...prev, [key]: text }));

  const togglePreference = (key) => setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));

  const genderLabel = (key) => t(`user.settings.genders.${key}`);
  const levelLabel = (key) => t(`user.onboarding.levels.${key}`);
  const goalLabel = (key) => t(`user.onboarding.goals.${key}`);

  const handleSave = async () => {
    const { medicalConditions, exactAddress } = values;
    const dateOfBirth = year && month && day
      ? `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      : '';

    if (!firstNameValue.trim() || !lastNameValue.trim() || !medicalConditions.trim() || !dateOfBirth || !exactAddress.trim()) {
      setError(t('user.settings.errorSaving'));
      return;
    }
    if (!DATE_RE.test(dateOfBirth)) {
      setError(t('user.settings.invalidDate'));
      return;
    }

    const birthdayIso = new Date(`${dateOfBirth}T00:00:00.000Z`);
    if (Number.isNaN(birthdayIso.getTime())) {
      setError(t('user.settings.invalidDate'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        firstName: firstNameValue.trim(),
        lastName: lastNameValue.trim(),
        gender: gender ?? undefined,
        trainingLevel: trainingLevel ?? undefined,
        objectives: mainGoal ? [mainGoal] : undefined,
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

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordError(t('user.settings.changePassword.errorFillAll'));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(t('user.settings.changePassword.errorTooShort'));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError(t('user.settings.changePassword.errorMismatch'));
      return;
    }

    setPasswordSaving(true);
    setPasswordError(null);
    try {
      await onChangePassword({ currentPassword, newPassword });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setPasswordError(err.message || t('user.settings.changePassword.errorFailed'));
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top bar: back chevron + title + "Guardar" link, per the mockup. */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} disabled={saving} hitSlop={12} style={styles.topBarSide}>
          <Text style={styles.backChevron}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{t('user.settings.editProfileTitle')}</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={12} style={[styles.topBarSide, styles.topBarSideRight]}>
          {saving ? (
            <ActivityIndicator color={globals.colors.primary} size="small" />
          ) : (
            <Text style={styles.saveLink}>{t('user.settings.save')}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Avatar (initials placeholder — there's no photo upload field on
          the Backend User model yet, so this can't be a real picture). */}
      <View style={styles.avatarBlock}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitials}>{initialsFor(firstNameValue, lastNameValue)}</Text>
        </View>
      </View>

      {/* Nombre */}
      <View style={styles.fieldBlock}>
        <TouchableOpacity style={styles.fieldRow} onPress={() => toggle('name')} activeOpacity={0.8}>
          <Text style={styles.fieldLabel}>{t('user.settings.name')}</Text>
          <Text style={styles.fieldValuePreview} numberOfLines={1}>
            {[firstNameValue, lastNameValue].filter(Boolean).join(' ')}
          </Text>
          <Text style={[styles.fieldArrow, openField === 'name' && styles.fieldArrowOpen]}>{'>'}</Text>
        </TouchableOpacity>
        {openField === 'name' && (
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder={t('user.settings.firstNamePlaceholder')}
              placeholderTextColor={globals.colors.textMuted}
              value={firstNameValue}
              onChangeText={setFirstNameValue}
              editable={!saving}
            />
            <TextInput
              style={[styles.input, { marginTop: globals.spacing.xs }]}
              placeholder={t('user.settings.lastNamePlaceholder')}
              placeholderTextColor={globals.colors.textMuted}
              value={lastNameValue}
              onChangeText={setLastNameValue}
              editable={!saving}
            />
          </View>
        )}
      </View>

      {/* Correo electrónico: not editable */}
      <View style={styles.fieldBlock}>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>{t('user.settings.mail')}</Text>
        </View>
        <View style={styles.inputWrapper}>
          <TextInput style={[styles.input, styles.inputDisabled]} value={email} editable={false} />
        </View>
      </View>

      {/* Fecha de nacimiento: day / month / year */}
      <View style={styles.fieldBlock}>
        <TouchableOpacity style={styles.fieldRow} onPress={() => toggle('dateOfBirth')} activeOpacity={0.8}>
          <Text style={styles.fieldLabel}>{t('user.settings.dateOfBirth')}</Text>
          <Text style={styles.fieldValuePreview} numberOfLines={1}>
            {day && month && year ? `${day}/${month}/${year}` : ''}
          </Text>
          <Text style={[styles.fieldArrow, openField === 'dateOfBirth' && styles.fieldArrowOpen]}>{'>'}</Text>
        </TouchableOpacity>
        {openField === 'dateOfBirth' && (
          <View style={styles.inputWrapper}>
            <View style={styles.dateRow}>
              <TextInput
                style={[styles.input, styles.dateInput]}
                placeholder={t('user.settings.dayPlaceholder')}
                placeholderTextColor={globals.colors.textMuted}
                value={day}
                onChangeText={setDay}
                keyboardType="number-pad"
                maxLength={2}
                editable={!saving}
              />
              <TextInput
                style={[styles.input, styles.dateInput]}
                placeholder={t('user.settings.monthPlaceholder')}
                placeholderTextColor={globals.colors.textMuted}
                value={month}
                onChangeText={setMonth}
                keyboardType="number-pad"
                maxLength={2}
                editable={!saving}
              />
              <TextInput
                style={[styles.input, styles.dateInput, styles.dateInputYear]}
                placeholder={t('user.settings.yearPlaceholder')}
                placeholderTextColor={globals.colors.textMuted}
                value={year}
                onChangeText={setYear}
                keyboardType="number-pad"
                maxLength={4}
                editable={!saving}
              />
            </View>
            {age != null && <Text style={styles.ageHint}>{t('user.settings.currentAge', { age })}</Text>}
          </View>
        )}
      </View>

      {/* Sexo */}
      <PillSelectRow
        label={t('user.settings.gender')}
        options={GENDER_OPTIONS}
        optionLabel={genderLabel}
        value={gender}
        onChange={setGender}
        disabled={saving}
      />

      {/* Nivel de experiencia */}
      <PillSelectRow
        label={t('user.settings.trainingLevel')}
        options={LEVEL_OPTIONS}
        optionLabel={levelLabel}
        value={trainingLevel}
        onChange={setTrainingLevel}
        disabled={saving}
      />

      {/* Objetivo principal */}
      <PillSelectRow
        label={t('user.settings.mainGoal')}
        options={GOAL_OPTIONS}
        optionLabel={goalLabel}
        value={mainGoal}
        onChange={setMainGoal}
        disabled={saving}
      />

      {/* Required free-text fields (medical conditions, exact address) */}
      {FIELDS.map(({ key, labelKey }) => {
        const isOpen = openField === key;
        const label = t(labelKey);
        return (
          <View key={key} style={styles.fieldBlock}>
            <TouchableOpacity style={styles.fieldRow} onPress={() => toggle(key)} activeOpacity={0.8}>
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
                  placeholder={t('user.settings.inputPlaceholder', { field: label.toLowerCase() })}
                  placeholderTextColor={globals.colors.textMuted}
                  value={values[key] ?? ''}
                  onChangeText={(text) => handleChange(key, text)}
                  editable={!saving}
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
          disabled={saving}
        >
          <Text style={styles.fieldLabel}>{t(labelKey)}</Text>
          <Text style={styles.checkbox}>{preferences[key] ? '☑' : '☐'}</Text>
        </TouchableOpacity>
      ))}

      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Cambiar contraseña */}
      {onChangePassword && (
        <>
          <Text style={styles.sectionTitle}>{t('user.settings.changePassword.title')}</Text>
          <View style={styles.fieldBlock}>
            <TouchableOpacity
              style={styles.fieldRow}
              onPress={() => setPasswordOpen((prev) => !prev)}
              activeOpacity={0.8}
            >
              <Text style={styles.fieldLabel}>{t('user.settings.changePassword.rowLabel')}</Text>
              <Text style={[styles.fieldArrow, passwordOpen && styles.fieldArrowOpen]}>{'>'}</Text>
            </TouchableOpacity>

            {passwordOpen && (
              <View style={styles.inputWrapper}>
                {passwordSuccess && (
                  <Text style={styles.successText}>{t('user.settings.changePassword.successMessage')}</Text>
                )}
                {passwordError && <Text style={styles.errorText}>{passwordError}</Text>}

                <TextInput
                  style={styles.input}
                  placeholder={t('user.settings.changePassword.currentPasswordPlaceholder')}
                  placeholderTextColor={globals.colors.textMuted}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  editable={!passwordSaving}
                  secureTextEntry
                />
                <TextInput
                  style={[styles.input, { marginTop: globals.spacing.xs }]}
                  placeholder={t('user.settings.changePassword.newPasswordPlaceholder')}
                  placeholderTextColor={globals.colors.textMuted}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  editable={!passwordSaving}
                  secureTextEntry
                />
                <TextInput
                  style={[styles.input, { marginTop: globals.spacing.xs }]}
                  placeholder={t('user.settings.changePassword.confirmPasswordPlaceholder')}
                  placeholderTextColor={globals.colors.textMuted}
                  value={confirmNewPassword}
                  onChangeText={setConfirmNewPassword}
                  editable={!passwordSaving}
                  secureTextEntry
                />

                {passwordSaving ? (
                  <ActivityIndicator color={globals.colors.primary} style={{ marginTop: globals.spacing.md }} />
                ) : (
                  <Button
                    label={t('user.settings.changePassword.submit')}
                    onPress={handleChangePassword}
                    style={{ marginTop: globals.spacing.md }}
                  />
                )}
              </View>
            )}
          </View>
        </>
      )}

      {/* Personal QR (display-only member badge — see file header comment) */}
      {userId ? (
        <View style={styles.qrSection}>
          <Text style={styles.sectionTitle}>{t('user.settings.qrTitle')}</Text>
          <Text style={styles.qrSubtitle}>{t('user.settings.qrSubtitle')}</Text>
          <View style={styles.qrCodeWrapper}>
            <QRCode value={JSON.stringify({ type: 'MEMBER', userId })} size={160} />
          </View>
        </View>
      ) : null}

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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: globals.colors.background,
    paddingHorizontal: globals.spacing.md,
    paddingVertical: globals.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: globals.colors.border,
  },
  topBarSide: {
    minWidth: 48,
  },
  topBarSideRight: {
    alignItems: 'flex-end',
  },
  backChevron: {
    fontSize: 28,
    color: globals.colors.text,
    lineHeight: 28,
  },
  topBarTitle: {
    fontSize: globals.fontSize.md,
    fontWeight: '700',
    color: globals.colors.text,
  },
  saveLink: {
    fontSize: globals.fontSize.md,
    fontWeight: '700',
    color: globals.colors.primary,
  },
  avatarBlock: {
    alignItems: 'center',
    marginVertical: globals.spacing.lg,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: globals.radius.full,
    backgroundColor: globals.colors.avatarPlaceholder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: globals.fontSize.xxl,
    fontWeight: '700',
    color: globals.colors.background,
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
  inputDisabled: {
    color: globals.colors.textMuted,
  },
  dateRow: {
    flexDirection: 'row',
    gap: globals.spacing.xs,
  },
  dateInput: {
    flex: 1,
    textAlign: 'center',
  },
  dateInputYear: {
    flex: 1.4,
  },
  ageHint: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    marginTop: globals.spacing.xs,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: globals.spacing.xs,
    paddingHorizontal: globals.spacing.md,
    paddingBottom: globals.spacing.md,
  },
  pill: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.full,
    paddingHorizontal: globals.spacing.md,
    paddingVertical: globals.spacing.sm,
    backgroundColor: globals.colors.background,
  },
  pillSelected: {
    borderColor: globals.colors.primary,
    backgroundColor: globals.colors.primary,
  },
  pillText: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.text,
  },
  pillTextSelected: {
    color: globals.colors.background,
    fontWeight: '600',
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
  successText: {
    color: globals.colors.primary,
    fontSize: globals.fontSize.sm,
    textAlign: 'center',
    marginBottom: globals.spacing.sm,
  },
  qrSection: {
    alignItems: 'center',
  },
  qrSubtitle: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: globals.spacing.lg,
    marginBottom: globals.spacing.sm,
  },
  qrCodeWrapper: {
    backgroundColor: globals.colors.background,
    padding: globals.spacing.md,
    borderRadius: globals.radius.md,
    borderWidth: 1,
    borderColor: globals.colors.primary,
  },
  buttonGroup: {
    paddingHorizontal: globals.spacing.md,
    marginTop: globals.spacing.lg,
    gap: globals.spacing.sm,
  },
});
