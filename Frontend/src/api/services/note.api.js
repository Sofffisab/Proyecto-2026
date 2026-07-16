// src/api/services/note.api.js
//
// Maps to Backend/src/routes/index.js "GET/POST /users/:id/notes" +
// "PUT/DELETE /users/:id/notes/:noteId" (TRAINER/ADMIN only), and
// Backend/src/controllers/note.controller.js / note.service.js. Powers
// the note-taking part of the Trainer's ProfileDataPopup (spec section 12:
// "sus notas, notas públicas, etc.").
//
// visibility: "PRIVATE" (default, only the authoring trainer + admins can
// read it) or "PUBLIC" (visible to any trainer helping this member).

import { apiClient } from '../client';

export function getNotes(userId) {
  return apiClient.get(`/users/${userId}/notes`);
}

export function createNote(userId, { note, visibility = 'PRIVATE' }) {
  return apiClient.post(`/users/${userId}/notes`, { note, visibility });
}

export function updateNote(userId, noteId, { note, visibility = 'PRIVATE' }) {
  return apiClient.put(`/users/${userId}/notes/${noteId}`, { note, visibility });
}

export function deleteNote(userId, noteId) {
  return apiClient.delete(`/users/${userId}/notes/${noteId}`);
}
