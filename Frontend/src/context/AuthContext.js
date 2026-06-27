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
      console.error('Error restoring session:', err);
      setError('Error restoring session');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    setError(null);
    setIsLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const BASE_URL = process.env.EXPO_PUBLIC_API_URL;
      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || 'Login failed';
        setError(errorMsg);
        throw new Error(errorMsg);
      }
        
      const { user, accessToken, refreshToken } = data.data;
      setUser(user);
      setTokens({ accessToken, refreshToken });
      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.setItem('tokens', JSON.stringify({ accessToken, refreshToken }));
      return user;

    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Request timeout - server not responding');
      } else {
        setError(err.message || 'Login failed');
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setUser(null);
    setTokens(null);
    setError(null);
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('tokens');
  };

  return (
    <AuthContext.Provider value={{ user, tokens, isLoading, error, login, logout }}>
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