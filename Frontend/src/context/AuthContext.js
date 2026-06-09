// src/context/AuthContext.js

import { createContext, useContext, useState } from 'react';

/**
 * Authentication context.
 * Stores the current user and their role.
 * Any component can read it via useAuth().
 */
const AuthContext = createContext(null);

/**
 * Context provider. Wraps the entire app in _layout.js.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  /**
   * Sets the authenticated user with the given role.
   * @param {string} role - One of the values defined in ROLES.
   */
  function login(role) {
    setUser({ role });
  }

  /**
   * Clears the session and returns to the login screen.
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
 * Hook to consume the auth context in any component.
 * Usage: const { user, login, logout } = useAuth();
 * Must be used inside an AuthProvider.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
}