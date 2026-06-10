import { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tokens, setTokens] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

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
      console.error('Error restoring session:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      setUser(data.user);
      setTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });

      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      await AsyncStorage.setItem('tokens', JSON.stringify({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      }));

      return data.user;
    } catch (err) {
      throw err;
    }
  };

  const logout = async () => {
    setUser(null);
    setTokens(null);
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('tokens');
  };

  return (
    <AuthContext.Provider value={{ user, tokens, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}