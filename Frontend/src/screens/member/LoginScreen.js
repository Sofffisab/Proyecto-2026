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

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>GymBros</Text>
        <Text style={styles.subtitle}>Login to your account</Text>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={globals.colors.border}
          value={email}
          onChangeText={setEmail}
          editable={!loading}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
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
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>
      </View>
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
});