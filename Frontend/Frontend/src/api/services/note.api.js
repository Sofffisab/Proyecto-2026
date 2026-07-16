// src/api/services/note.api.js
//
// Maps 1:1 to Backend/src/routes/index.js "TRAINER NOTES ROUTES" and
// Backend/src/controllers/note.controller.js. TRAINER/ADMIN only.
// Powers the ProfileDataPopup (spec section 12): "notes, public notes, etc."
// Backend/src/services/note.service.js#getNotes already scopes visibility
// server-side (a trainer sees their own notes, public or private, plus any
// PUBLIC note left by another trainer) — the client just splits the result
// by trainerId to render "my notes" vs "other trainers' public notes".

import { apiClient } from '../client';

// GET /users/:id/notes
export function getNotes(userId) {
  return apiClient.get(`/users/${userId}/notes`);
}

// POST /users/:id/notes — body: { note, visibility?: 'PUBLIC' | 'PRIVATE' }
export function createNote(userId, { note, visibility } = {}) {
  return apiClient.post(`/users/${userId}/notes`, { note, visibility });
}

// PUT /users/:id/notes/:noteId — body: { note, visibility? }
export function updateNote(userId, noteId, { note, visibility } = {}) {
  return apiClient.put(`/users/${userId}/notes/${noteId}`, { note, visibility });
}

// DELETE /users/:id/notes/:noteId
export function deleteNote(userId, noteId) {
  return apiClient.delete(`/users/${userId}/notes/${noteId}`);
}
