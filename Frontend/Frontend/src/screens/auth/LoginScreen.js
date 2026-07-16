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

export default function LoginScreen({
  onLogin,
  onForgotPassword,
  onBack,
  onProvisionalNewUser,
  onProvisionalUser,
  onProvisionalTrainer,
  onProvisionalAdmin,
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError(t('auth.login.errorFillFields'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err.message || t('auth.login.errorLoginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('auth.login.appName')}</Text>
        <Text style={styles.subtitle}>{t('auth.login.subtitle')}</Text>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TextInput
          style={styles.input}
          placeholder={t('auth.login.emailPlaceholder')}
          placeholderTextColor={globals.colors.border}
          value={email}
          onChangeText={setEmail}
          editable={!loading}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder={t('auth.login.passwordPlaceholder')}
          placeholderTextColor={globals.colors.border}
          value={password}
          onChangeText={setPassword}
          editable={!loading}
          secureTextEntry
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={globals.colors.background} />
          ) : (
            <Text style={styles.buttonText}>{t('auth.login.loginButton')}</Text>
          )}
        </TouchableOpacity>

        {/* Forgot password button (spec: Initial Screen) - static, no logic */}
        <TouchableOpacity style={styles.linkButton} onPress={onForgotPassword}>
          <Text style={styles.linkText}>{t('auth.login.forgotPassword')}</Text>
        </TouchableOpacity>

        {/*
          There's no backend connected yet, so a real login doesn't exist
          nor a way to know the user's role/status. These provisional
          shortcuts simulate every possible login outcome so the rest of
          the screens can be navigated to and tested.
        */}
        <View style={styles.provisionalGroup}>
          <Text style={styles.provisionalTitle}>{t('auth.login.provisionalTitle')}</Text>

          <TouchableOpacity style={styles.provisionalButton} onPress={onProvisionalNewUser}>
            <Text style={styles.provisionalText}>
              {t('auth.login.provisionalNewUser')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.provisionalButton} onPress={onProvisionalUser}>
            <Text style={styles.provisionalText}>
              {t('auth.login.provisionalUser')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.provisionalButton} onPress={onProvisionalTrainer}>
            <Text style={styles.provisionalText}>
              {t('auth.login.provisionalTrainer')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.provisionalButton} onPress={onProvisionalAdmin}>
            <Text style={styles.provisionalText}>
              {t('auth.login.provisionalAdmin')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Back button (global rule: present on all screens) - static */}
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.linkText}>{t('auth.login.back')}</Text>
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
    marginBottom: globals.spacing.lg,
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
    marginTop: globals.spacing.lg,
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
    marginVertical: globals.spacing.sm,
  },
  linkButton: {
    alignItems: 'center',
    marginTop: globals.spacing.sm,
  },
  linkText: {
    color: globals.colors.primary,
    fontSize: globals.fontSize.sm,
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: globals.spacing.md,
  },
  provisionalGroup: {
    marginTop: globals.spacing.lg,
    paddingTop: globals.spacing.md,
    borderTopWidth: 1,
    borderTopColor: globals.colors.border,
    gap: globals.spacing.sm,
  },
  provisionalTitle: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    textAlign: 'center',
    marginBottom: globals.spacing.xs,
  },
  provisionalButton: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    paddingHorizontal: globals.spacing.md,
    paddingVertical: globals.spacing.sm,
    backgroundColor: globals.colors.secondary,
  },
  provisionalText: {
    color: globals.colors.text,
    fontSize: globals.fontSize.sm,
    textAlign: 'center',
  },
});
