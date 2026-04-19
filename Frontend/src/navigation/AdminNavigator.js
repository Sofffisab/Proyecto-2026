import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AdminHomeScreen from '../screens/admin/HomeScreen';
import AdminMembersScreen from '../screens/admin/MembersScreen';
import AdminStatsScreen from '../screens/admin/StatsScreen';
import AdminPerformanceScreen from '../screens/admin/PerformanceScreen';

const Stack = createNativeStackNavigator();

function AdminNavigator() {
  return (
    <Stack.Navigator initialRouteName="AdminHome">
      <Stack.Screen
        name="AdminHome"
        component={AdminHomeScreen}
        options={{ title: 'Panel Admin' }}
      />
      <Stack.Screen
        name="AdminMembers"
        component={AdminMembersScreen}
        options={{ title: 'Miembros' }}
      />
      <Stack.Screen
        name="AdminStats"
        component={AdminStatsScreen}
        options={{ title: 'Estadisticas' }}
      />
      <Stack.Screen
        name="AdminPerformance"
        component={AdminPerformanceScreen}
        options={{ title: 'Desempenio' }}
      />
    </Stack.Navigator>
  );
}

export default AdminNavigator;