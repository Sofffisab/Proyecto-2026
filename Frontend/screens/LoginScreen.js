import { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Login Screen (mockup: pantallashtml/IniciarSesion2.html).
 *
 * @param {function} onLogin - async (email, password) => void. Wired by
 *   RootNavigator to AuthContext#login, i.e. POST /auth/login (see
 *   Backend/src/controllers/auth.controller.js#login).
 * @param {function} [onForgotPassword]
 * @param {function} [onBack]
 */
export default function LoginScreen({
  onLogin,
  onForgotPassword,
  onBack,
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      await onLogin(email.trim(), password);
    } catch (err) {
      setError(err.message || t('auth.login.errorLoginFailed'));
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
      {/* Back button (global rule: present on all screens) */}
      <Pressable style={styles.backButton} onPress={onBack} hitSlop={12}>
        <Image
          source={require('../../assets/basil_caret-left-outline.png')}
          style={styles.backIcon}
        />
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.title}>{t('auth.login.title')}</Text>
        <Text style={styles.subtitle}>{t('auth.login.subtitle')}</Text>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.field}>
        <Text style={styles.label}>{t('auth.login.emailLabel')}</Text>
        <View style={styles.inputWrapper}>
          <Image
            source={require('../../assets/Gmail.png')}
            style={styles.iconLeft}
          />
          <TextInput
            style={styles.input}
            placeholder={t('auth.login.emailPlaceholder')}
            placeholderTextColor={globals.colors.textMuted}
            value={email}
            onChangeText={setEmail}
            editable={!loading}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t('auth.login.passwordLabel')}</Text>
        <View style={styles.inputWrapper}>
          <Image
            source={require('../../assets/Candado2.png')}
            style={styles.iconLeft}
          />
          <TextInput
            style={styles.input}
            placeholder={t('auth.login.passwordPlaceholder')}
            placeholderTextColor={globals.colors.textMuted}
            value={password}
            onChangeText={setPassword}
            editable={!loading}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
          <Pressable
            style={styles.iconRightWrapper}
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={12}
          >
            <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
          </Pressable>
        </View>
      </View>

      {/* Forgot password link (spec: Initial Screen) */}
      <TouchableOpacity
        style={styles.linkButton}
        onPress={onForgotPassword}
        disabled={!onForgotPassword}
      >
        <Text style={styles.linkText}>{t('auth.login.forgotPassword')}</Text>
      </TouchableOpacity>

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
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    width: '100%',
    minHeight: 48,
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.lg,
    paddingLeft: 44,
    paddingRight: 40,
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
    backgroundColor: globals.colors.background,
  },
  iconLeft: {
    position: 'absolute',
    left: 14,
    width: 18,
    height: 18,
    resizeMode: 'contain',
    zIndex: 1,
  },
  iconRightWrapper: {
    position: 'absolute',
    right: 12,
  },
  eyeIcon: {
    fontSize: 16,
  },
  linkButton: {
    alignSelf: 'flex-end',
    marginTop: globals.spacing.xs,
    marginBottom: globals.spacing.lg,
  },
  linkText: {
    color: globals.colors.primary,
    fontSize: globals.fontSize.sm,
    fontWeight: '600',
  },
  button: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.lg,
    paddingVertical: globals.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: globals.spacing.sm,
  },
});
