import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TrainerHomeScreen from '../screens/trainer/HomeScreen';
import TrainerSettingsScreen from '../screens/trainer/SettingsScreen';

const Stack = createNativeStackNavigator();

function TrainerNavigator() {
  return (
    <Stack.Navigator initialRouteName="TrainerHome">
      <Stack.Screen
        name="TrainerHome"
        component={TrainerHomeScreen}
        options={{ title: 'Panel Entrenador' }}
      />
      <Stack.Screen
        name="TrainerSettings"
        component={TrainerSettingsScreen}
        options={{ title: 'Mi perfil' }}
      />
    </Stack.Navigator>
  );
}

export default TrainerNavigator;