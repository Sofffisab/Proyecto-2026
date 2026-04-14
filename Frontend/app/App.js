import { StatusBar } from 'expo-status-bar'
import { StyleSheet, View } from 'react-native'
import { colors } from '../src/styles/colors'

// Componente raíz. Acá se configura la navegación global cuando se agregue.
export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  // Fondo tomado del token de color para mantener consistencia global.
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
})