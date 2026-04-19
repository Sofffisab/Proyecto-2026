import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';

/**
 * Componente raiz de la aplicacion.
 * AuthProvider envuelve todo para que cualquier pantalla pueda
 * saber quien esta logueado usando useAuth().
 */

function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

export default App;