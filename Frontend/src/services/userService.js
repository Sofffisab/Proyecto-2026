import api from './api'

// Conecta con: backend/rutas.js → endpoints de usuarios
// El token se adjunta automáticamente via interceptor en api.js

// Obtener perfil del usuario autenticado
export const getProfile = () =>
  api.get('/users/profile')

// Actualizar datos del perfil
export const updateProfile = (data) =>
  api.put('/users/profile', data)

// Cambiar contraseña
export const changePassword = (currentPassword, newPassword) =>
  api.put('/users/password', { currentPassword, newPassword })