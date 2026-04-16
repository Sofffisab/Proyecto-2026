import api from './api'

// Conecta con: backend/rutas.js → endpoints de autenticación
// Todos los errores se dejan propagar para manejarlos en el componente que llama.

// Registrar nuevo usuario
export const register = (nombre, email, password) =>
  api.post('/auth/register', { nombre, email, password })

// Iniciar sesión — devuelve token JWT en la respuesta
export const login = (email, password) =>
  api.post('/auth/login', { email, password })

// Cerrar sesión — si el backend maneja blacklist de tokens
export const logout = () =>
  api.post('/auth/logout')