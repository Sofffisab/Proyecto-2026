import { useEffect, useRef, useState } from 'react';
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
  Linking,
} from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';

const RESEND_SECONDS = 60;

/**
 * Forgot Password Screen (spec section 1, "Botón Recuperar contraseña").
 * Reached from the Login screen. Two steps:
 *
 *   1. "request": enter the account email, POST /auth/forgot-password
 *      (Backend never reveals whether the email exists, so this always
 *      succeeds the same way — see auth.controller.js#forgotPassword).
 *   2. "code": enter the code from that email, confirmed against the
 *      Backend via POST /auth/verify-reset-code (see
 *      auth.controller.js#verifyResetCode) *before* moving on — an
 *      invalid/expired code shows an error right here instead of only
 *      surfacing later on the new-password screen.
 *
 * @param {function} onSubmit - async (email) => void. Wired by
 *   RootNavigator to AuthContext#forgotPassword.
 * @param {function} [onBack]
 * @param {function} [onVerifyCode] - async (email, code) => void. Wired to
 *   AuthContext#verifyResetCode, i.e. POST /auth/verify-reset-code. Throws
 *   if the code is wrong/expired.
 * @param {function} [onGoToReset] - (code) => void. Called only once the
 *   code has been confirmed valid; navigates to ResetPasswordScreen
 *   carrying that code.
 */
export default function ForgotPasswordScreen({ onSubmit, onBack, onVerifyCode, onGoToReset }) {
  const { t } = useTranslation();
  const [step, setStep] = useState('request'); // 'request' | 'code'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(RESEND_SECONDS);
  const timerRef = useRef(null);

  useEffect(() => {
    if (step !== 'code') return undefined;
    timerRef.current = setInterval(() => {
      setResendSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [step]);

  const handleSendEmail = async () => {
    if (!email.trim()) {
      setError(t('auth.forgotPassword.errorFillEmail'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSubmit(email.trim());
      setStep('code');
      setResendSeconds(RESEND_SECONDS);
    } catch (err) {
      setError(err.message || t('auth.forgotPassword.errorFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendSeconds > 0 || loading) return;
    setLoading(true);
    setError(null);
    try {
      await onSubmit(email.trim());
      setResendSeconds(RESEND_SECONDS);
    } catch (err) {
      setError(err.message || t('auth.forgotPassword.errorFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenMailApp = () => {
    // Best-effort: opens whatever mail client the OS has registered for
    // mailto: links (Gmail, Outlook, Mail, etc). If none is registered,
    // Linking.openURL rejects and we just ignore it — the person can still
    // open their mail app manually and use the code field below.
    Linking.openURL('mailto:').catch(() => {});
  };

  const handleChangeEmail = () => {
    clearInterval(timerRef.current);
    setStep('request');
    setCode('');
    setError(null);
  };

  const handleVerifyCode = async () => {
    if (!code.trim()) {
      setError(t('auth.forgotPassword.errorFillCode'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onVerifyCode?.(email.trim(), code.trim());
      onGoToReset?.(code.trim());
    } catch (err) {
      setError(err.message || t('auth.forgotPassword.errorInvalidCode'));
    } finally {
      setLoading(false);
    }
  };

  if (step === 'code') {
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

        <View style={styles.iconCircle}>
          <Image
            source={require('../../assets/basil_envelope-outline.png')}
            style={styles.envelopeIcon}
          />
          <View style={styles.checkBadge}>
            <Image
              source={require('../../assets/basil_check-solid.png')}
              style={styles.checkBadgeIcon}
            />
          </View>
        </View>

        <Text style={styles.checkTitle}>{t('auth.forgotPassword.checkEmailTitle')}</Text>
        <Text style={styles.checkSubtitle}>
          {t('auth.forgotPassword.checkEmailSubtitle')}{' '}
          <Text style={styles.checkEmailBold}>{email.trim()}</Text>
        </Text>
        <Text style={styles.checkInstructions}>
          {t('auth.forgotPassword.checkEmailInstructions')}
        </Text>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity style={styles.button} onPress={handleOpenMailApp}>
          <Text style={styles.buttonText}>{t('auth.forgotPassword.openMailApp')}</Text>
        </TouchableOpacity>

        <View style={styles.field}>
          <Text style={styles.label}>{t('auth.forgotPassword.codeLabel')}</Text>
          <TextInput
            style={styles.codeInput}
            placeholder={t('auth.forgotPassword.codePlaceholder')}
            placeholderTextColor={globals.colors.textMuted}
            value={code}
            onChangeText={setCode}
            editable={!loading}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="number-pad"
            maxLength={6}
          />
        </View>

        <TouchableOpacity
          style={[styles.secondaryButton, loading && styles.buttonDisabled]}
          onPress={handleVerifyCode}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={globals.colors.primary} />
          ) : (
            <Text style={styles.secondaryButtonText}>{t('auth.forgotPassword.verifyCode')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={handleResend}
          disabled={resendSeconds > 0 || loading}
        >
          <Text style={[styles.linkText, resendSeconds > 0 && styles.linkTextDisabled]}>
            {resendSeconds > 0
              ? t('auth.forgotPassword.resendCodeIn', { seconds: resendSeconds })
              : t('auth.forgotPassword.resendCode')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={handleChangeEmail}>
          <Text style={styles.linkText}>{t('auth.forgotPassword.changeEmail')}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

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
        <Text style={styles.title}>{t('auth.forgotPassword.title')}</Text>
        <Text style={styles.subtitle}>{t('auth.forgotPassword.subtitle')}</Text>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.field}>
        <Text style={styles.label}>{t('auth.forgotPassword.emailLabel')}</Text>
        <View style={styles.inputWrapper}>
          <Image
            source={require('../../assets/Gmail.png')}
            style={styles.iconLeft}
          />
          <TextInput
            style={styles.input}
            placeholder={t('auth.forgotPassword.emailPlaceholder')}
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

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSendEmail}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={globals.colors.background} />
        ) : (
          <Text style={styles.buttonText}>{t('auth.forgotPassword.submit')}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.linkButton} onPress={onBack}>
        <Text style={styles.linkText}>{t('auth.forgotPassword.backToLogin')}</Text>
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
    marginBottom: globals.spacing.lg,
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
    paddingRight: 16,
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
  codeInput: {
    width: '100%',
    minHeight: 48,
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.lg,
    paddingHorizontal: 16,
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
    backgroundColor: globals.colors.background,
    letterSpacing: 2,
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
  linkButton: {
    alignItems: 'center',
    marginTop: globals.spacing.lg,
  },
  linkText: {
    color: globals.colors.primary,
    fontSize: globals.fontSize.sm,
    fontWeight: '600',
  },
  linkTextDisabled: {
    color: globals.colors.textMuted,
  },

  // "check your email" step
  iconCircle: {
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: globals.colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: globals.spacing.xl,
    marginBottom: globals.spacing.lg,
  },
  envelopeIcon: {
    width: 44,
    height: 44,
    resizeMode: 'contain',
    tintColor: globals.colors.primary,
  },
  checkBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: globals.colors.primary,
    borderWidth: 2,
    borderColor: globals.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkBadgeIcon: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
    tintColor: globals.colors.background,
  },
  secondaryButton: {
    backgroundColor: globals.colors.background,
    borderWidth: 1.5,
    borderColor: globals.colors.primary,
    borderRadius: globals.radius.lg,
    paddingVertical: globals.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 50,
    marginTop: globals.spacing.sm,
  },
  secondaryButtonText: {
    color: globals.colors.primary,
    fontSize: globals.fontSize.md,
    fontWeight: '600',
  },
  checkTitle: {
    fontSize: globals.fontSize.xl,
    fontWeight: '700',
    color: globals.colors.text,
    textAlign: 'center',
    marginBottom: globals.spacing.sm,
  },
  checkSubtitle: {
    fontSize: globals.fontSize.md,
    color: globals.colors.textMuted,
    textAlign: 'center',
  },
  checkEmailBold: {
    fontWeight: '700',
    color: globals.colors.text,
  },
  checkInstructions: {
    fontSize: globals.fontSize.md,
    color: globals.colors.textMuted,
    textAlign: 'center',
    marginTop: globals.spacing.xs,
    marginBottom: globals.spacing.lg,
  },
});
