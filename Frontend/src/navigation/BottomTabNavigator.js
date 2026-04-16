import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { colors } from '../styles/colors'
// import HomeScreen from '../screens/HomeScreen' // descomentar cuando exista

// Navegación inferior. Agregar cada tab nueva acá.
// Cada tab puede tener su propio StackNavigator interno si lo necesita.
const Tab = createBottomTabNavigator()

export default function BottomTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.background },
      }}
    >
      {/* <Tab.Screen name="Home" component={HomeScreen} /> */}
    </Tab.Navigator>
  )
}