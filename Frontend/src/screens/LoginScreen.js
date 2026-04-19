// src/screens/LoginScreen.js

import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import Button from '../components/common/Button';
import ROLES from '../constants/roles';
import globals from '../styles/globals';

/**
 * Pantalla de inicio de sesion.
 * Por ahora el usuario elige su rol con un boton.
 * Cuando haya backend, aqui iran los inputs de credenciales.
 */
function LoginScreen() {
  const { login } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bienvenido</Text>
      <Text style={styles.subtitle}>Ingresa como:</Text>

      <Button label="Miembro" onPress={() => login(ROLES.MEMBER)} />
      <Button label="Entrenador" onPress={() => login(ROLES.TRAINER)} />
      <Button label="Admin" onPress={() => login(ROLES.ADMIN)} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: globals.spacing.lg,
    backgroundColor: globals.colors.background,
  },
  title: {
    fontSize: globals.fontSize.xxl,
    fontWeight: 'bold',
    color: globals.colors.text,
    marginBottom: globals.spacing.sm,
  },
  subtitle: {
    fontSize: globals.fontSize.lg,
    color: globals.colors.textLight,
    marginBottom: globals.spacing.lg,
  },
});

export default LoginScreen;