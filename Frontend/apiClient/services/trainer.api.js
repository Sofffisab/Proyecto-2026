// Trainer-facing endpoints (the trainer's Home / Gym / Ayudar / Historial /
// Denunciar / Conflictos / Rutinas screens). Maps to
// Backend/src/routes/index.js and the matching controllers.

import { apiClient } from '../client';

// ── Gym ──
export const getGymSummary = () => apiClient.get('/gym/summary');
export const getPeopleInGym = () => apiClient.get('/gym/people');
export const getPersonInGym = (userId) => apiClient.get(`/gym/people/${userId}`);

// ── Ayuda ──
// "Ir a ayudar": takes the member's pending request or starts a help on the spot.
export const startHelp = (userId) => apiClient.post('/assistance/start', { userId });
export const completeHelp = (assistanceId) => apiClient.patch(`/assistance/${assistanceId}/complete`);
export const setAvailability = (availability) => apiClient.patch('/assistance/trainer/availability', { availability });
export const getHelpHistory = () => apiClient.get('/history/trainer-assistance');

// ── Notas ──
export const createNote = (userId, note, visibility) => apiClient.post(`/users/${userId}/notes`, { note, visibility });

// ── Conflictos de máquina ──
export const getMachineConflicts = () => apiClient.get('/qr/machine-conflicts');
export const resolveMachineConflict = (id, resolution) => apiClient.patch(`/qr/machine-conflicts/${id}/resolve`, { resolution });

// ── Denunciar ──
export const reportPerson = ({ reportedUserId, reason, message }) =>
  apiClient.post('/complaints/trainer', { reportedUserId, reason, message });
export const reportMachine = ({ machineId, comment }) => apiClient.post('/denuncias/machine', { machineId, comment });
export const getTrainers = () => apiClient.get('/trainers');
export const getMachines = () => apiClient.get('/qr/gym-access');

// ── Pedidos de rutina ──
export const getRoutineRequests = () => apiClient.get('/routines/requests/all');
export const acceptRoutineRequest = (id) => apiClient.patch(`/routines/requests/${id}/accept`);
export const rejectRoutineRequest = (id) => apiClient.patch(`/routines/requests/${id}/reject`);
export const proposeRoutine = (id, { name, exercises }) => apiClient.patch(`/routines/requests/${id}/propose`, { name, exercises });
export const getExercises = () => apiClient.get('/routines/exercises');
