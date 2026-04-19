import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MemberHomeScreen from '../screens/member/HomeScreen';
import MemberSettingsScreen from '../screens/member/SettingsScreen';


const Stack = createNativeStackNavigator();

function MemberNavigator() {
  return (
    <Stack.Navigator initialRouteName="MemberHome">
      <Stack.Screen
        name="MemberHome"
        component={MemberHomeScreen}
        options={{ title: 'Inicio' }}
      />
      <Stack.Screen
        name="MemberSettings"
        component={MemberSettingsScreen}
        options={{ title: 'Mi perfil' }}
      />
    </Stack.Navigator>
  );
}

export default MemberNavigator;