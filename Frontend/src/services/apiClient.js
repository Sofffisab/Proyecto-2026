import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuración base de Axios
const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1', // Ajusta tu URL base
  timeout: 10000, // 10 segundos antes de dar timeout por falta de conexión
  headers: {
    'Content-Type': 'application/json',
  },
});

// INTERCEPTOR DE PETICIONES: Inyecta el token automáticamente si existe
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('[apiClient] Error al recuperar el token del Storage:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// INTERCEPTOR DE RESPUESTAS: Centraliza y formatea los errores del backend (401, 500, etc.)
apiClient.interceptors.response.use(
  (response) => {
    // Si la respuesta es exitosa, devolvemos directo los datos limpios
    return response.data;
  },
  (error) => {
    let normalizedError = {
      message: 'Something went wrong. Please try again.',
      status: error.response?.status || 500,
      errors: null, // Para guardar errores específicos de validación del backend
    };

    if (error.response) {
      // El backend respondió con un código de error (4xx, 5xx)
      const backendData = error.response.data;
      
      normalizedError.message = backendData?.message || normalizedError.message;
      normalizedError.errors = backendData?.errors || null;

      // Manejo específico según el código de estado
      switch (error.response.status) {
        case 401:
          console.warn('[apiClient] Unauthorized - Redirigiendo a Login o limpiando sesión...');
          // Aquí podrías disparar una función para borrar el AsyncStorage y desautenticar
          break;
        case 403:
          console.warn('[apiClient] Forbidden - No tienes permisos para esta acción.');
          break;
        case 500:
          console.error('[apiClient] Server Error (500):', normalizedError.message);
          break;
      }
    } else if (error.request) {
      // La petición se hizo pero el backend nunca respondió (Error de red o servidor apagado)
      normalizedError.message = 'Cannot connect to the server. Check your internet connection.';
      console.error('[apiClient] Network Error:', error.message);
    } else {
      // Error al configurar la petición
      normalizedError.message = error.message;
    }

    // Devolvemos el error estandarizado. Al usar Promise.reject, la pantalla lo recibirá en su catch.
    return Promise.reject(normalizedError);
  }
);

export default apiClient;