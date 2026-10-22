import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
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
 * which isn't editable server-side): medical conditions, date of birth,
 * exact address.
 *
 * Visual spec ported 1:1 from the "Editar perfil" mockups:
 *   - a top bar with a back chevron, "Editar perfil" title and "Guardar";
 *   - an avatar with a pencil edit badge;
 *   - ONE continuous white card, rows separated by hairlines (not
 *     individually-shadowed blocks) for: Nombre, Correo electrónico,
 *     Fecha de nacimiento, Sexo, Nivel de entrenamiento;
 *   - each editable row expands in place and shows a small teal
 *     check-circle button to confirm/collapse it (the "basil_check-solid"
 *     asset concept, drawn here as a checkmark on a teal circle);
 *   - Correo electrónico shows a red border + "Información incorrecta"
 *     under it while the typed value isn't a valid email shape;
 *   - Sexo expands into 3 equal-width pill buttons (Masculino / Femenino
 *     / Otro), matching the mockup's segmented-control look;
 *   - Objetivo principal and Lesiones/enfermedades are both tag lists:
 *     selected tags render as filled teal chips with a small "-" to
 *     remove them, plus a "+" tile that opens a tiny "¿Qué querés
 *     agregar?" prompt to add a custom one — matching the mockup's
 *     "Agregue aqui" popovers;
 *   - "Mi QR" section, unchanged from before (already matched the mockup);
 *   - the bottom red button was framed as "Eliminar cuenta" in the
 *     visual references, but per product decision this triggers a normal
 *     logout instead (self-service account deletion isn't a thing — only
 *     ADMIN can deactivate accounts, see Backend "PATCH /users/:id/status").
 *     Kept in the same red/danger slot, labeled as logout, calls `onLogout`.
 *
 * Field <-> Backend mapping (see Backend/src/validators/user.schemas.js
 * #updateUserSchema):
 *   firstName / lastName -> firstName / lastName: string (edited here as
 *                            a single "Nombre" field, split on the last
 *                            space when saving)
 *   gender              -> gender: "MALE"|"FEMALE"|"OTHER"|"PREFER_NOT_TO_SAY"
 *   trainingLevel       -> trainingLevel: ExperienceLevel
 *   objectives          -> objectives: MainGoal[] (real multi-select now;
 *                            the Backend already stores an array)
 *   medicalConditions   -> medicalConditions: string[]
 *   dateOfBirth         -> birthday: ISO datetime string
 *   exactAddress        -> deliveryAddress: string
 *   noTrainerHelp       -> disableAssistance: boolean
 *   noMachineApp        -> machineTrackingOptOut: boolean
 *
 * Email is shown as an editable-looking field (matches the mockup) but is
 * validated client-side only and deliberately NOT sent in the onSave
 * payload — the session email isn't patchable through this endpoint.
 *
 * @param {string}   [firstName]
 * @param {string}   [lastName]
 * @param {string}   [email] - Session email, shown but not saved.
 * @param {string}   [userId] - Encoded into the personal QR code.
 * @param {number|null} [age] - Derived server-side from birthday.
 * @param {object}   [initialValues] - Pre-fill from the current user.
 * @param {function} onSave - async (patch) => void
 * @param {function} [onChangePassword]
 * @param {function} [onBack]
 * @param {function} [onLogout] - fired by the bottom red button.
 */
const GENDER_OPTIONS = ['MALE', 'FEMALE', 'OTHER'];
const LEVEL_OPTIONS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const GOAL_OPTIONS = ['LOSE_WEIGHT', 'GAIN_MUSCLE', 'IMPROVE_HEALTH', 'INCREASE_ENDURANCE'];
const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function initialsFor(firstName, lastName) {
  const a = (firstName || '').trim().charAt(0);
  const b = (lastName || '').trim().charAt(0);
  return (a + b).toUpperCase() || '?';
}

/** Left-side row icon slot (glyph-based, zero new asset requirement). */
function RowIcon({ glyph }) {
  return (
    <View style={styles.rowIconWrap}>
      <Text style={styles.rowIconGlyph}>{glyph}</Text>
    </View>
  );
}

/** Chevron on the right of every accordion row; rotates when open. */
function RowArrow({ open }) {
  return <Text style={[styles.fieldArrow, open && styles.fieldArrowOpen]}>{'\u203A'}</Text>;
}

/** Small teal circle + checkmark used to confirm/collapse an inline edit. */
function ConfirmCheck({ onPress, error }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.confirmCheck, error && styles.confirmCheckError]}
      hitSlop={8}
    >
      <Text style={styles.confirmCheckGlyph}>{'\u2713'}</Text>
    </TouchableOpacity>
  );
}

/** A row that expands into a single confirmable text input. */
function TextFieldRow({
  icon,
  label,
  value,
  placeholder,
  onChangeText,
  isOpen,
  onToggle,
  disabled,
  errorText,
  keyboardType,
}) {
  const hasError = Boolean(errorText);
  return (
    <View style={styles.fieldBlock}>
      <TouchableOpacity style={styles.fieldRow} onPress={onToggle} activeOpacity={0.8}>
        <RowIcon glyph={icon} />
        <Text style={styles.fieldLabel}>{label}</Text>
        {!isOpen && (
          <Text style={styles.fieldValuePreview} numberOfLines={1}>
            {value || ''}
          </Text>
        )}
        <RowArrow open={isOpen} />
      </TouchableOpacity>
      {isOpen && (
        <View style={styles.inputWrapper}>
          <View style={styles.inputWithCheckRow}>
            <TextInput
              style={[styles.input, styles.inputFlex, hasError && styles.inputError]}
              placeholder={placeholder}
              placeholderTextColor={globals.colors.textMuted}
              value={value}
              onChangeText={onChangeText}
              editable={!disabled}
              keyboardType={keyboardType}
            />
            <ConfirmCheck onPress={onToggle} error={hasError} />
          </View>
          {hasError && <Text style={styles.inlineErrorText}>{errorText}</Text>}
        </View>
      )}
    </View>
  );
}

/** A row that expands into equal-width pill buttons (single-select). */
function PillSelectRow({ icon, label, options, optionLabel, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.fieldBlock}>
      <TouchableOpacity style={styles.fieldRow} onPress={() => setOpen((p) => !p)} activeOpacity={0.8}>
        <RowIcon glyph={icon} />
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValuePreview} numberOfLines={1}>
          {value ? optionLabel(value) : ''}
        </Text>
        <RowArrow open={open} />
      </TouchableOpacity>

      {open && (
        <View style={styles.segmentWrap}>
          {options.map((opt) => {
            const selected = value === opt;
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.segmentButton, selected && styles.segmentButtonSelected]}
                onPress={() => onChange(opt)}
                disabled={disabled}
              >
                <Text style={[styles.segmentButtonText, selected && styles.segmentButtonTextSelected]}>
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

/**
 * A row that expands into a tag list (multi-select) with a "+" tile that
 * opens a tiny prompt for adding a free-text custom tag — matches the
 * "¿Que objetivo te gustaria agregar?" / "Agregue aqui" popovers.
 */
function TagFieldRow({
  icon,
  label,
  selected,
  presetOptions,
  optionLabel,
  onToggleOption,
  onAddCustom,
  onRemoveCustom,
  customTags,
  isOpen,
  onToggle,
  addPromptTitle,
  addPlaceholder,
  hintText,
  disabled,
}) {
  const [showAddPrompt, setShowAddPrompt] = useState(false);
  const [draft, setDraft] = useState('');

  const previewText = selected.length
    ? selected.map((s) => optionLabel(s)).join(' · ')
    : '';

  const confirmAdd = () => {
    const trimmed = draft.trim();
    if (trimmed) onAddCustom(trimmed);
    setDraft('');
    setShowAddPrompt(false);
  };

  return (
    <View style={styles.fieldBlock}>
      <TouchableOpacity style={styles.fieldRow} onPress={onToggle} activeOpacity={0.8}>
        <RowIcon glyph={icon} />
        <Text style={styles.fieldLabel}>{label}</Text>
        {!isOpen && (
          <Text style={styles.fieldValuePreview} numberOfLines={1}>
            {previewText}
          </Text>
        )}
        <RowArrow open={isOpen} />
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.tagWrap}>
          {presetOptions.map((opt) => {
            const isSelected = selected.includes(opt);
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.tagChip, isSelected && styles.tagChipSelected]}
                onPress={() => onToggleOption(opt)}
                disabled={disabled}
              >
                <Text style={[styles.tagChipText, isSelected && styles.tagChipTextSelected]} numberOfLines={1}>
                  {optionLabel(opt)}
                </Text>
                {isSelected && <Text style={styles.tagChipRemove}>{'\u2212'}</Text>}
              </TouchableOpacity>
            );
          })}

          {customTags.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={[styles.tagChip, styles.tagChipSelected]}
              onPress={() => onRemoveCustom(tag)}
              disabled={disabled}
            >
              <Text style={[styles.tagChipText, styles.tagChipTextSelected]} numberOfLines={1}>
                {tag}
              </Text>
              <Text style={styles.tagChipRemove}>{'\u2212'}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.tagAddButton}
            onPress={() => setShowAddPrompt(true)}
            disabled={disabled}
          >
            <Text style={styles.tagAddButtonGlyph}>{'+'}</Text>
          </TouchableOpacity>

          {hintText && (selected.length + customTags.length === 0) && (
            <Text style={styles.tagHintText}>{hintText}</Text>
          )}
        </View>
      )}

      <Modal visible={showAddPrompt} transparent animationType="fade" onRequestClose={() => setShowAddPrompt(false)}>
        <View style={styles.overlay}>
          <View style={styles.addPromptCard}>
            <Text style={styles.addPromptTitle}>{addPromptTitle}</Text>
            <View style={styles.inputWithCheckRow}>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                placeholder={addPlaceholder}
                placeholderTextColor={globals.colors.textMuted}
                value={draft}
                onChangeText={setDraft}
                autoFocus
              />
              <ConfirmCheck onPress={confirmAdd} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** Day / month / year row that opens a month+year wheel-style modal. */
function BirthdayRow({ icon, label, day, month, year, onChangeDay, onChangeMonth, onChangeYear, isOpen, onToggle, ageHint, disabled, monthLabel }) {
  const [showWheel, setShowWheel] = useState(false);
  const monthIndex = month ? parseInt(month, 10) - 1 : null;

  return (
    <View style={styles.fieldBlock}>
      <TouchableOpacity style={styles.fieldRow} onPress={onToggle} activeOpacity={0.8}>
        <RowIcon glyph={icon} />
        <Text style={styles.fieldLabel}>{label}</Text>
        {!isOpen && (
          <Text style={styles.fieldValuePreview} numberOfLines={1}>
            {day && month && year ? `${day} / ${monthLabel(monthIndex)} / ${year}` : ''}
          </Text>
        )}
        <RowArrow open={isOpen} />
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.inputWrapper}>
          <View style={styles.dateRow}>
            <TextInput
              style={[styles.input, styles.dateInput]}
              placeholder="DD"
              placeholderTextColor={globals.colors.textMuted}
              value={day}
              onChangeText={onChangeDay}
              keyboardType="number-pad"
              maxLength={2}
              editable={!disabled}
            />
            <TouchableOpacity
              style={[styles.input, styles.dateInput, styles.dateMonthButton]}
              onPress={() => setShowWheel(true)}
              disabled={disabled}
            >
              <Text style={styles.dateMonthButtonText} numberOfLines={1}>
                {month ? monthLabel(monthIndex) : 'mes'}
              </Text>
            </TouchableOpacity>
            <TextInput
              style={[styles.input, styles.dateInput, styles.dateInputYear]}
              placeholder="AAAA"
              placeholderTextColor={globals.colors.textMuted}
              value={year}
              onChangeText={onChangeYear}
              keyboardType="number-pad"
              maxLength={4}
              editable={!disabled}
            />
          </View>
          {ageHint != null && <Text style={styles.ageHint}>{ageHint}</Text>}
        </View>
      )}

      {/* Month/year wheel-style picker modal — teal header, scrollable
          month list, matches the "Noviembre / 1627" mockup panel. */}
      <Modal visible={showWheel} transparent animationType="slide" onRequestClose={() => setShowWheel(false)}>
        <View style={styles.overlay}>
          <View style={styles.wheelCard}>
            <View style={styles.wheelHeader}>
              <Text style={styles.wheelHeaderText}>
                {(month ? monthLabel(monthIndex) : 'Mes')} / {year || 'Año'}
              </Text>
            </View>
            <ScrollView style={styles.wheelList}>
              {MONTHS.map((m, idx) => {
                const value = String(idx + 1).padStart(2, '0');
                const isSelected = value === month;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.wheelRow, isSelected && styles.wheelRowSelected]}
                    onPress={() => onChangeMonth(value)}
                  >
                    <Text style={[styles.wheelRowText, isSelected && styles.wheelRowTextSelected]}>
                      {monthLabel(idx)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.inputWithCheckRow}>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                placeholder="Año"
                placeholderTextColor={globals.colors.textMuted}
                value={year}
                onChangeText={onChangeYear}
                keyboardType="number-pad"
                maxLength={4}
              />
              <ConfirmCheck onPress={() => setShowWheel(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const PREFERENCES = [
  { key: 'noTrainerHelp', labelKey: 'user.settings.noTrainerHelp' },
  { key: 'noMachineApp', labelKey: 'user.settings.noMachineApp' },
];

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
  onLogout,
}) {
  const { t } = useTranslation();
  const [openField, setOpenField] = useState(null);
  const toggle = (key) => setOpenField((prev) => (prev === key ? null : key));

  // ---- Nombre: single combined field, split on save ----
  const [nameValue, setNameValue] = useState([firstName, lastName].filter(Boolean).join(' '));

  // ---- Correo: visual only, not sent to the backend ----
  const [emailValue, setEmailValue] = useState(email);
  const emailError = emailValue.length > 0 && !EMAIL_RE.test(emailValue)
    ? t('user.settings.emailInvalid')
    : null;

  const [gender, setGender] = useState(initialValues.gender ?? null);
  const [trainingLevel, setTrainingLevel] = useState(initialValues.trainingLevel ?? null);

  // ---- Objetivo principal: now a real multi-select ----
  const initialGoals = Array.isArray(initialValues.objectives) ? initialValues.objectives : [];
  const [selectedGoals, setSelectedGoals] = useState(initialGoals.filter((g) => GOAL_OPTIONS.includes(g)));
  const [customGoals, setCustomGoals] = useState(initialGoals.filter((g) => !GOAL_OPTIONS.includes(g)));

  // ---- Lesiones / enfermedades: multi-select + custom ----
  const initialConditions = Array.isArray(initialValues.medicalConditionsList)
    ? initialValues.medicalConditionsList
    : (initialValues.medicalConditions
        ? initialValues.medicalConditions.split(',').map((s) => s.trim()).filter(Boolean)
        : []);
  const CONDITION_PRESETS = ['injuries', 'heartCondition', 'asthma', 'diabetes', 'none'];
  const [selectedConditions, setSelectedConditions] = useState(
    initialConditions.filter((c) => CONDITION_PRESETS.includes(c))
  );
  const [customConditions, setCustomConditions] = useState(
    initialConditions.filter((c) => !CONDITION_PRESETS.includes(c))
  );

  const initialDate = initialValues.dateOfBirth ?? '';
  const [year, setYear] = useState(initialDate ? initialDate.slice(0, 4) : '');
  const [month, setMonth] = useState(initialDate ? initialDate.slice(5, 7) : '');
  const [day, setDay] = useState(initialDate ? initialDate.slice(8, 10) : '');

  const [exactAddress, setExactAddress] = useState(initialValues.exactAddress ?? '');

  const [preferences, setPreferences] = useState({
    noTrainerHelp: Boolean(initialValues.disableAssistance),
    noMachineApp: Boolean(initialValues.machineTrackingOptOut),
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const togglePreference = (key) => setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));

  const genderLabel = (key) => t(`user.settings.genders.${key}`);
  const levelLabel = (key) => t(`user.onboarding.levels.${key}`);
  const goalLabel = (key) => (GOAL_OPTIONS.includes(key) ? t(`user.onboarding.goals.${key}`) : key);
  const conditionLabel = (key) =>
    CONDITION_PRESETS.includes(key) ? t(`user.settings.conditionPresets.${key}`) : key;
  const monthLabel = (idx) => (idx == null ? '' : t(`user.settings.months.${MONTHS[idx]}`));

  const toggleGoal = (g) =>
    setSelectedGoals((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  const addCustomGoal = (text) => setCustomGoals((prev) => Array.from(new Set([...prev, text])));
  const removeCustomGoal = (text) => setCustomGoals((prev) => prev.filter((x) => x !== text));

  const toggleCondition = (c) =>
    setSelectedConditions((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  const addCustomCondition = (text) => setCustomConditions((prev) => Array.from(new Set([...prev, text])));
  const removeCustomCondition = (text) => setCustomConditions((prev) => prev.filter((x) => x !== text));

  const handleSave = async () => {
    const allConditions = [...selectedConditions, ...customConditions];
    const dateOfBirth = year && month && day
      ? `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      : '';

    if (!nameValue.trim() || allConditions.length === 0 || !dateOfBirth || !exactAddress.trim()) {
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

    const [firstNamePart, ...rest] = nameValue.trim().split(/\s+/);
    const lastNamePart = rest.join(' ');

    setSaving(true);
    setError(null);
    try {
      await onSave({
        firstName: firstNamePart,
        lastName: lastNamePart,
        gender: gender ?? undefined,
        trainingLevel: trainingLevel ?? undefined,
        objectives: [...selectedGoals, ...customGoals],
        medicalConditions: allConditions,
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

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    onLogout && onLogout();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top bar: back chevron + title + "Guardar" link */}
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

      {/* Avatar + edit-photo badge */}
      <View style={styles.avatarBlock}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitials}>{initialsFor(firstName, lastName)}</Text>
        </View>
        <View style={styles.avatarEditBadge}>
          <Text style={styles.avatarEditGlyph}>{'\u270E'}</Text>
        </View>
      </View>

      {/* ---------------- ONE continuous card ---------------- */}
      <View style={styles.card}>
        <TextFieldRow
          icon={"\uD83D\uDC64"}
          label={t('user.settings.name')}
          value={nameValue}
          placeholder={t('user.settings.firstNamePlaceholder')}
          onChangeText={setNameValue}
          isOpen={openField === 'name'}
          onToggle={() => toggle('name')}
          disabled={saving}
        />

        <TextFieldRow
          icon={"\u2709"}
          label={t('user.settings.mail')}
          value={emailValue}
          placeholder={t('user.settings.mail')}
          onChangeText={setEmailValue}
          isOpen={openField === 'mail'}
          onToggle={() => toggle('mail')}
          disabled={saving}
          errorText={openField === 'mail' ? emailError : null}
          keyboardType="email-address"
        />

        <BirthdayRow
          icon={"\uD83C\uDF82"}
          label={t('user.settings.dateOfBirth')}
          day={day}
          month={month}
          year={year}
          onChangeDay={setDay}
          onChangeMonth={setMonth}
          onChangeYear={setYear}
          isOpen={openField === 'dateOfBirth'}
          onToggle={() => toggle('dateOfBirth')}
          ageHint={age != null ? t('user.settings.currentAge', { age }) : null}
          disabled={saving}
          monthLabel={monthLabel}
        />

        <PillSelectRow
          icon={'\u26A7'}
          label={t('user.settings.gender')}
          options={GENDER_OPTIONS}
          optionLabel={genderLabel}
          value={gender}
          onChange={setGender}
          disabled={saving}
        />

        <PillSelectRow
          icon={'\uD83C\uDFCB'}
          label={t('user.settings.trainingLevel')}
          options={LEVEL_OPTIONS}
          optionLabel={levelLabel}
          value={trainingLevel}
          onChange={setTrainingLevel}
          disabled={saving}
        />

        <TagFieldRow
          icon={'\uD83C\uDFC6'}
          label={t('user.settings.mainGoal')}
          selected={selectedGoals}
          presetOptions={GOAL_OPTIONS}
          optionLabel={goalLabel}
          onToggleOption={toggleGoal}
          onAddCustom={addCustomGoal}
          onRemoveCustom={removeCustomGoal}
          customTags={customGoals}
          isOpen={openField === 'mainGoal'}
          onToggle={() => toggle('mainGoal')}
          addPromptTitle={t('user.settings.addGoalPrompt')}
          addPlaceholder={t('user.settings.addGoalPlaceholder')}
          disabled={saving}
        />

        <TagFieldRow
          icon={'\u2764'}
          label={t('user.settings.medicalConditions')}
          selected={selectedConditions}
          presetOptions={CONDITION_PRESETS}
          optionLabel={conditionLabel}
          onToggleOption={toggleCondition}
          onAddCustom={addCustomCondition}
          onRemoveCustom={removeCustomCondition}
          customTags={customConditions}
          isOpen={openField === 'medicalConditions'}
          onToggle={() => toggle('medicalConditions')}
          addPromptTitle={t('user.settings.addConditionPrompt')}
          addPlaceholder={t('user.settings.addConditionPlaceholder')}
          hintText={t('user.settings.conditionsHint')}
          disabled={saving}
        />

        <TextFieldRow
          icon={"\uD83C\uDFE0"}
          label={t('user.settings.exactAddress')}
          value={exactAddress}
          placeholder={t('user.settings.inputPlaceholder', { field: t('user.settings.exactAddress').toLowerCase() })}
          onChangeText={setExactAddress}
          isOpen={openField === 'exactAddress'}
          onToggle={() => toggle('exactAddress')}
          disabled={saving}
        />
      </View>

      {/* Preferences */}
      <Text style={styles.sectionTitle}>{t('user.settings.preferencesTitle')}</Text>
      <View style={styles.card}>
        {PREFERENCES.map(({ key, labelKey }, idx) => (
          <TouchableOpacity
            key={key}
            style={[styles.preferenceRow, idx > 0 && styles.rowDivider]}
            onPress={() => togglePreference(key)}
            disabled={saving}
          >
            <Text style={styles.fieldLabel}>{t(labelKey)}</Text>
            <Text style={styles.checkbox}>{preferences[key] ? '☑' : '☐'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Cambiar contraseña */}
      {onChangePassword && (
        <>
          <Text style={styles.sectionTitle}>{t('user.settings.changePassword.title')}</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.fieldRow}
              onPress={() => setPasswordOpen((prev) => !prev)}
              activeOpacity={0.8}
            >
              <RowIcon glyph={'\uD83D\uDD12'} />
              <Text style={styles.fieldLabel}>{t('user.settings.changePassword.rowLabel')}</Text>
              <RowArrow open={passwordOpen} />
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

      {/* Personal QR (display-only member badge) */}
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

        {/* Same red/danger slot the mockups show at the bottom of Editar
            Perfil — wired to a normal logout (with confirmation) instead
            of account deletion, per product decision. */}
        {onLogout && (
          <Button
            label={t('user.settings.logoutButton')}
            onPress={() => setShowLogoutConfirm(true)}
            variant="danger"
            disabled={saving}
          />
        )}
      </View>

      <Modal
        visible={showLogoutConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutConfirm(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.addPromptCard}>
            <Text style={styles.addPromptTitle}>{t('user.home.logoutConfirmTitle')}</Text>
            <Text style={styles.fieldLabel}>{t('user.home.logoutConfirmMessage')}</Text>
            <View style={styles.confirmRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowLogoutConfirm(false)}
              >
                <Text style={styles.modalButtonSecondaryLabel}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonDanger]} onPress={confirmLogout}>
                <Text style={styles.modalButtonLabel}>{t('user.settings.logoutButton')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    position: 'relative',
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
  avatarEditBadge: {
    position: 'absolute',
    right: '32%',
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: globals.radius.full,
    backgroundColor: globals.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: globals.colors.background,
  },
  avatarEditGlyph: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.background,
  },

  card: {
    backgroundColor: globals.colors.background,
    marginHorizontal: globals.spacing.md,
    borderRadius: globals.radius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },

  rowIconWrap: {
    width: 28,
    alignItems: 'center',
    marginRight: globals.spacing.xs,
  },
  rowIconGlyph: {
    fontSize: globals.fontSize.md,
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
    borderTopWidth: 1,
    borderTopColor: globals.colors.border,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: globals.colors.border,
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
  inputWithCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: globals.spacing.xs,
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
  inputFlex: {
    flex: 1,
  },
  inputError: {
    borderColor: globals.colors.danger,
  },
  inlineErrorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    marginTop: globals.spacing.xs,
  },

  confirmCheck: {
    width: 30,
    height: 30,
    borderRadius: globals.radius.full,
    backgroundColor: globals.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCheckError: {
    backgroundColor: globals.colors.danger,
  },
  confirmCheckGlyph: {
    color: globals.colors.background,
    fontWeight: '700',
  },

  dateRow: {
    flexDirection: 'row',
    gap: globals.spacing.xs,
  },
  dateInput: {
    flex: 1,
    textAlign: 'center',
  },
  dateMonthButton: {
    justifyContent: 'center',
  },
  dateMonthButtonText: {
    textAlign: 'center',
    color: globals.colors.text,
  },
  dateInputYear: {
    flex: 1.4,
  },
  ageHint: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    marginTop: globals.spacing.xs,
  },

  segmentWrap: {
    flexDirection: 'row',
    gap: globals.spacing.xs,
    paddingHorizontal: globals.spacing.md,
    paddingBottom: globals.spacing.md,
  },
  segmentButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.full,
    paddingVertical: globals.spacing.sm,
    alignItems: 'center',
    backgroundColor: globals.colors.background,
  },
  segmentButtonSelected: {
    borderColor: globals.colors.primary,
    backgroundColor: globals.colors.primary,
  },
  segmentButtonText: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.text,
  },
  segmentButtonTextSelected: {
    color: globals.colors.background,
    fontWeight: '600',
  },

  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: globals.spacing.xs,
    paddingHorizontal: globals.spacing.md,
    paddingBottom: globals.spacing.md,
    alignItems: 'center',
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.full,
    paddingHorizontal: globals.spacing.md,
    paddingVertical: globals.spacing.sm,
    backgroundColor: globals.colors.background,
    gap: globals.spacing.xs,
  },
  tagChipSelected: {
    borderColor: globals.colors.primary,
    backgroundColor: globals.colors.primary,
  },
  tagChipText: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.text,
    maxWidth: 160,
  },
  tagChipTextSelected: {
    color: globals.colors.background,
    fontWeight: '600',
  },
  tagChipRemove: {
    color: globals.colors.background,
    fontWeight: '700',
  },
  tagAddButton: {
    width: 34,
    height: 34,
    borderRadius: globals.radius.full,
    backgroundColor: globals.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagAddButtonGlyph: {
    color: globals.colors.background,
    fontSize: globals.fontSize.md,
    fontWeight: '700',
  },
  tagHintText: {
    width: '100%',
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    marginTop: globals.spacing.xs,
  },

  addPromptCard: {
    width: '85%',
    backgroundColor: globals.colors.background,
    borderRadius: globals.radius.lg,
    padding: globals.spacing.lg,
  },
  addPromptTitle: {
    fontSize: globals.fontSize.md,
    fontWeight: '700',
    color: globals.colors.text,
    marginBottom: globals.spacing.md,
  },

  wheelCard: {
    width: '85%',
    maxHeight: '70%',
    backgroundColor: globals.colors.background,
    borderRadius: globals.radius.lg,
    overflow: 'hidden',
  },
  wheelHeader: {
    backgroundColor: globals.colors.primary,
    paddingVertical: globals.spacing.md,
    alignItems: 'center',
  },
  wheelHeaderText: {
    color: globals.colors.background,
    fontWeight: '700',
    fontSize: globals.fontSize.md,
  },
  wheelList: {
    maxHeight: 260,
  },
  wheelRow: {
    paddingVertical: globals.spacing.md,
    paddingHorizontal: globals.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: globals.colors.border,
  },
  wheelRowSelected: {
    backgroundColor: globals.colors.backgroundAlt,
  },
  wheelRowText: {
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
    textAlign: 'center',
  },
  wheelRowTextSelected: {
    color: globals.colors.primary,
    fontWeight: '700',
  },

  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: globals.spacing.md,
    paddingVertical: globals.spacing.md,
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

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: globals.spacing.sm,
    marginTop: globals.spacing.md,
  },
  modalButton: {
    backgroundColor: globals.colors.primary,
    paddingVertical: globals.spacing.sm,
    paddingHorizontal: globals.spacing.lg,
    borderRadius: globals.radius.md,
    alignItems: 'center',
    marginTop: globals.spacing.md,
  },
  modalButtonLabel: {
    color: globals.colors.secondary,
    fontWeight: '600',
  },
  modalButtonSecondary: {
    backgroundColor: globals.colors.secondary,
    borderWidth: 1,
    borderColor: globals.colors.border,
  },
  modalButtonSecondaryLabel: {
    color: globals.colors.text,
    fontWeight: '600',
  },
  modalButtonDanger: {
    backgroundColor: globals.colors.danger,
  },
});
