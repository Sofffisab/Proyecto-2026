import { createContext, useContext, useState } from 'react';

/**
 * Contexto de autenticacion.
 * Guarda el usuario actual y su rol.
 * Cualquier componente puede leerlo con useAuth().
 */
const AuthContext = createContext(null);

/**
 * Proveedor del contexto. Envuelve toda la app en App.js.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  /**
   * Simula el login con un rol elegido.
   * @param {string} role - uno de los valores de ROLES
   */
  function login(role) {
    setUser({ role });
  }

  /**
   * Cierra la sesion y vuelve al login.
   */
  function logout() {
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook para usar el contexto en cualquier componente.
 * Uso: const { user, login, logout } = useAuth();
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}