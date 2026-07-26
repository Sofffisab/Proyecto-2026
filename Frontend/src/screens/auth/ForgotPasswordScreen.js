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
 * Forgot Password Screen (spec section 1, "Botón Recuperar contraseña").
 * Reached from the Initial/Login screen. Always shows the same generic
 * confirmation once submitted, since the Backend never reveals whether an
 * email is registered (see Backend/src/controllers/auth.controller.js
 * #forgotPassword / services/auth.service.js).
 *
 * @param {function} onSubmit - async (email) => void. Caller (RootNavigator)
 *   wires this to AuthContext#forgotPassword, i.e. POST /auth/forgot-password.
 * @param {function} [onBack]
 */
export default function ForgotPasswordScreen({ onSubmit, onBack }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError(t('auth.forgotPassword.errorFillEmail'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSubmit(email.trim());
      setSent(true);
    } catch (err) {
      setError(err.message || t('auth.forgotPassword.errorFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('auth.forgotPassword.title')}</Text>
        <Text style={styles.subtitle}>{t('auth.forgotPassword.subtitle')}</Text>

        {sent ? (
          <Text style={styles.successText}>{t('auth.forgotPassword.successMessage')}</Text>
        ) : (
          <>
            {error && <Text style={styles.errorText}>{error}</Text>}

            <TextInput
              style={styles.input}
              placeholder={t('auth.forgotPassword.emailPlaceholder')}
              placeholderTextColor={globals.colors.border}
              value={email}
              onChangeText={setEmail}
              editable={!loading}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={globals.colors.background} />
              ) : (
                <Text style={styles.buttonText}>{t('auth.forgotPassword.submit')}</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Back button (global rule: present on all screens) */}
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.linkText}>{t('auth.forgotPassword.back')}</Text>
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
