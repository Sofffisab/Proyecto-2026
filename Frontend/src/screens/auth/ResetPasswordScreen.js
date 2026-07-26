import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Reset Password Screen (spec section 1, flujo de "Recuperar contraseña").
 * Reached after ForgotPasswordScreen sends the reset-password mail. The
 * user pastes the token from that mail and picks a new password here.
 *
 * @param {function} onSubmit - async ({ token, newPassword }) => void.
 *   Caller (RootNavigator) wires this to AuthContext#resetPassword, i.e.
 *   POST /auth/reset-password.
 * @param {function} [onBack]
 * @param {function} [onDone] - called after a successful reset, to send
 *   the user back to Login so they can sign in with the new password.
 */
export default function ResetPasswordScreen({ onSubmit, onBack, onDone }) {
  const { t } = useTranslation();
  const [token, setToken] = useState('');
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
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('auth.resetPassword.title')}</Text>
        <Text style={styles.subtitle}>{t('auth.resetPassword.subtitle')}</Text>

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

            <TextInput
              style={styles.input}
              placeholder={t('auth.resetPassword.tokenPlaceholder')}
              placeholderTextColor={globals.colors.border}
              value={token}
              onChangeText={setToken}
              editable={!loading}
              autoCapitalize="none"
            />

            <TextInput
              style={styles.input}
              placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
              placeholderTextColor={globals.colors.border}
              value={newPassword}
              onChangeText={setNewPassword}
              editable={!loading}
              secureTextEntry
            />

            <TextInput
              style={styles.input}
              placeholder={t('auth.resetPassword.confirmPasswordPlaceholder')}
              placeholderTextColor={globals.colors.border}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!loading}
              secureTextEntry
            />

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
      </View>

      {/* Back button (global rule: present on all screens) */}
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.linkText}>{t('auth.resetPassword.back')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: globals.colors.background,
    justifyContent: 'center',
    paddingHorizontal: '5%',
  },
  content: {
    width: '100%',
    gap: globals.spacing.md,
  },
  title: {
    fontSize: globals.fontSize.xxl,
    fontWeight: '700',
    color: globals.colors.primary,
    textAlign: 'center',
    marginBottom: globals.spacing.sm,
  },
  subtitle: {
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
    textAlign: 'center',
    marginBottom: globals.spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    paddingHorizontal: globals.spacing.md,
    paddingVertical: globals.spacing.sm,
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
    backgroundColor: globals.colors.secondary,
    minHeight: 50,
  },
  button: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: globals.spacing.md,
    minHeight: 50,
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
  },
  successText: {
    color: globals.colors.primary,
    fontSize: globals.fontSize.md,
    textAlign: 'center',
    marginTop: globals.spacing.md,
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: globals.spacing.md,
  },
  linkText: {
    color: globals.colors.primary,
    fontSize: globals.fontSize.sm,
  },
});
