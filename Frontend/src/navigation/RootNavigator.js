import { NavigationContainer } from '@react-navigation/native'
import { useState } from 'react'
import AppStack from './StackNavigator'
// import AuthStack from './AuthStack' // descomentar cuando exista

// Navegador raíz. Decide qué stack mostrar según si el usuario está autenticado.
// isLoggedIn debe reemplazarse por el estado real de autenticación (contexto/store).
export default function RootNavigator() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  return (
    <NavigationContainer>
      {isLoggedIn ? <AppStack /> : <AppStack />}
      {/* Reemplazar segunda instancia por <AuthStack /> cuando esté listo */}
    </NavigationContainer>
  )
}