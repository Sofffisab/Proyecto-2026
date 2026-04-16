import { createNativeStackNavigator } from '@react-navigation/native-stack'
// import HomeScreen from '../screens/HomeScreen' // descomentar cuando exista

// Stack principal de la app. Cada pantalla se apila sobre la anterior.
// Agregar cada pantalla nueva en el array de screens.
const Stack = createNativeStackNavigator()

export default function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* <Stack.Screen name="Home" component={HomeScreen} /> */}
    </Stack.Navigator>
  )
}