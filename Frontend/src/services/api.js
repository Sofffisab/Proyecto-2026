import axios from 'axios'

// URL base del backend. Cambiar según entorno (local, staging, producción).
// En Android con emulador usar 10.0.2.2 en lugar de localhost.
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 segundos
})

// Interceptor de request: adjunta el token en cada llamada automáticamente.
// Reemplazar el token hardcodeado por el que venga del contexto/store de auth.
api.interceptors.request.use(
  (config) => {
    // const token = getTokenFromStore()
    // if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error)
)

// Interceptor de response: maneja errores globales como token expirado (401).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Acá se puede despachar logout global
      console.warn('Sesión expirada o no autorizada')
    }
    return Promise.reject(error)
  }
)

export default api