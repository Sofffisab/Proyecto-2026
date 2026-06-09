import { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tokens, setTokens] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      const storedTokens = await AsyncStorage.getItem('tokens');

      if (storedUser && storedTokens) {
        setUser(JSON.parse(storedUser));
        setTokens(JSON.parse(storedTokens));
      }
    } catch (err) {
      console.error('[AUTH] Error restoring session:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      setIsLoading(true);

      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Guardar usuario y tokens
      setUser(data.user);
      setTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });

      // Persistir en AsyncStorage
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      await AsyncStorage.setItem('tokens', JSON.stringify({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      }));

      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Notificar al backend
      if (tokens?.accessToken) {
        await fetch('http://localhost:3000/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`,
          },
        });
      }

      setUser(null);
      setTokens(null);
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('tokens');
    } catch (err) {
      console.error('[AUTH] Error logging out:', err);
    }
  };

  const refreshAccessToken = async () => {
    if (!tokens?.refreshToken) {
      throw new Error('No refresh token');
    }

    try {
      const response = await fetch('http://localhost:3000/api/auth/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const newTokens = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      };

      setTokens(newTokens);
      await AsyncStorage.setItem('tokens', JSON.stringify(newTokens));

      return newTokens.accessToken;
    } catch (err) {
      // Si falla, logout
      logout();
      throw err;
    }
  };

  const getAccessToken = () => tokens?.accessToken;

  return (
    <AuthContext.Provider
      value={{
        user,
        tokens,
        isLoading,
        error,
        login,
        logout,
        refreshAccessToken,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
}