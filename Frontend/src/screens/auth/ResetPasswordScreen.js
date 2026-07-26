import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  Image,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Reset Password Screen (spec section 1, flujo de "Recuperar contraseña").
 * Reached after ForgotPasswordScreen's "check your email" step, which
 * already validated the code via POST /auth/verify-reset-code and passes
 * it in as `initialToken`. This screen only asks for the new password;
 * the code is submitted again here together with it, since that's still
 * the Backend's actual password-changing call (see Backend/src/
 * controllers/auth.controller.js#resetPassword) — in the rare case the
 * code expires in between the two screens, that surfaces as
 * `errorFailed` below.
 *
 * @param {string} [initialToken] - code/token carried over from
 *   ForgotPasswordScreen.
 * @param {function} onSubmit - async ({ token, newPassword }) => void.
 *   Caller (RootNavigator) wires this to AuthContext#resetPassword, i.e.
 *   POST /auth/reset-password.
 * @param {function} [onBack]
 * @param {function} [onDone] - called after a successful reset, to send
 *   the user back to Login so they can sign in with the new password.
 */
export default function ResetPasswordScreen({ initialToken = '', onSubmit, onBack, onDone }) {
  const { t } = useTranslation();
  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!token.trim() || !newPassword || !confirmPassword) {
      setError(t('auth.resetPassword.errorFillAll'));
      return;
    }
    if (newPassword.length < 8) {
      setError(t('auth.resetPassword.errorTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth.resetPassword.errorMismatch'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSubmit({ token: token.trim(), newPassword });
      setDone(true);
    } catch (err) {
      setError(err.message || t('auth.resetPassword.errorFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable style={styles.backButton} onPress={onBack} hitSlop={12}>
        <Image
          source={require('../../assets/basil_caret-left-outline.png')}
          style={styles.backIcon}
        />
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.title}>{t('auth.resetPassword.title')}</Text>
        <Text style={styles.subtitle}>{t('auth.resetPassword.subtitle')}</Text>
      </View>

      {done ? (
        <>
          <Text style={styles.successText}>{t('auth.resetPassword.successMessage')}</Text>
          <TouchableOpacity style={styles.button} onPress={onDone}>
            <Text style={styles.buttonText}>{t('auth.resetPassword.goToLogin')}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {error && <Text style={styles.errorText}>{error}</Text>}

          {/* Code field: pre-filled from the previous step. Still editable
              in case the person needs to fix a typo, or this screen is
              ever reached without a code already carried over. */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('auth.resetPassword.codeConfirmedLabel')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth.resetPassword.tokenPlaceholder')}
              placeholderTextColor={globals.colors.textMuted}
              value={token}
              onChangeText={setToken}
              editable={!loading}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('auth.resetPassword.newPasswordLabel')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
              placeholderTextColor={globals.colors.textMuted}
              value={newPassword}
              onChangeText={setNewPassword}
              editable={!loading}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('auth.resetPassword.confirmPasswordLabel')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth.resetPassword.confirmPasswordPlaceholder')}
              placeholderTextColor={globals.colors.textMuted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!loading}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={globals.colors.background} />
            ) : (
              <Text style={styles.buttonText}>{t('auth.resetPassword.submit')}</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: globals.colors.background,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: '6%',
    paddingTop: globals.spacing.md,
    paddingBottom: globals.spacing.xl,
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
  },
  backIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  header: {
    marginTop: globals.spacing.lg,
    marginBottom: globals.spacing.lg,
  },
  title: {
    fontSize: globals.fontSize.xl,
    fontWeight: '700',
    color: globals.colors.text,
    marginBottom: globals.spacing.xs,
  },
  subtitle: {
    fontSize: globals.fontSize.md,
    color: globals.colors.textMuted,
  },
  field: {
    marginBottom: globals.spacing.md,
  },
  label: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    marginBottom: globals.spacing.xs,
  },
  input: {
    width: '100%',
    minHeight: 48,
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.lg,
    paddingHorizontal: 16,
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
    backgroundColor: globals.colors.background,
  },
  button: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.lg,
    paddingVertical: globals.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 50,
    marginTop: globals.spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: globals.colors.background,
    fontSize: globals.fontSize.md,
    fontWeight: '600',
  },
  errorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    textAlign: 'center',
    marginBottom: globals.spacing.sm,
  },
  successText: {
    color: globals.colors.primary,
    fontSize: globals.fontSize.md,
    textAlign: 'center',
    marginBottom: globals.spacing.lg,
  },
});
