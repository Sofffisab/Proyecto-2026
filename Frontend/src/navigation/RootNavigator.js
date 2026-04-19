import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import ROLES from '../constants/roles';
import LoginScreen from '../screens/LoginScreen';
import MemberNavigator from './MemberNavigator';
import TrainerNavigator from './TrainerNavigator';
import AdminNavigator from './AdminNavigator';

/**
 * Navegador raiz.
 * - Si no hay usuario: muestra la pantalla de login.
 * - Si hay usuario: muestra el navegador de su rol.
 *
 * Logica:
 *   user === null          → LoginScreen
 *   user.role === member   → MemberNavigator
 *   user.role === trainer  → TrainerNavigator
 *   user.role === admin    → AdminNavigator
 */

const Stack = createNativeStackNavigator();

function RootNavigator() {
  const { user } = useAuth();

  // Sin sesion: muestra solo el login
  if (!user) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  // Con sesion: muestra el navegador del rol correspondiente
  return (
    <NavigationContainer>
      {user.role === ROLES.MEMBER && <MemberNavigator />}
      {user.role === ROLES.TRAINER && <TrainerNavigator />}
      {user.role === ROLES.ADMIN && <AdminNavigator />}
    </NavigationContainer>
  );
}

export default RootNavigator;