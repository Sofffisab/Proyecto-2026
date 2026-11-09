// Admin-only endpoints. Maps to Backend/src/routes/index.js ("ADMIN SCREENS")
// and Backend/src/controllers/admin.controller.js / reward.controller.js.
// Every function resolves to the Backend envelope { success, data }.

import { apiClient } from '../client';

// ── Miembros ──
export const getMembers = () => apiClient.get('/admin/members');
// body: { email, role?: 'USER'|'TRAINER'|'ADMIN', firstName?, lastName? }. The
// Backend emails the person a link to choose their password; the answer says
// whether that mail was accepted (data.emailSent).
export const createMember = (body) => apiClient.post('/admin/members', body);
export const resendInvite = (userId) => apiClient.post(`/admin/members/${userId}/resend-invite`);
export const setMemberActive = (userId, isActive) => apiClient.patch(`/admin/members/${userId}/active`, { isActive });

// ── Estadísticas / Historial ──
export const getStats = () => apiClient.get('/admin/stats');
export const getHistory = ({ role, before, limit } = {}) => {
  const q = [];
  if (role) q.push(`role=${encodeURIComponent(role)}`);
  if (before) q.push(`before=${encodeURIComponent(before)}`);
  if (limit) q.push(`limit=${limit}`);
  return apiClient.get(`/admin/history${q.length ? `?${q.join('&')}` : ''}`);
};

// ── Denuncias ──  kind: 'COMPLAINT' | 'DENUNCIA'
export const getReports = (state = 'PENDING') => apiClient.get(`/admin/reports?state=${state}`);
export const acceptReport = (kind, id) => apiClient.patch(`/admin/reports/${kind}/${id}/accept`);
export const rejectReport = (kind, id) => apiClient.patch(`/admin/reports/${kind}/${id}/reject`);
export const escalateReport = (kind, id) => apiClient.patch(`/admin/reports/${kind}/${id}/escalate`);
export const revertReport = (kind, id) => apiClient.patch(`/admin/reports/${kind}/${id}/revert`);
export const getSuspicious = () => apiClient.get('/admin/reports/suspicious');
export const getReportsOfUser = (userId) => apiClient.get(`/admin/reports/user/${userId}`);
export const getReviewRequests = () => apiClient.get('/admin/reports/review-requests');
export const resolveReviewRequest = (id) => apiClient.patch(`/admin/reports/review-requests/${id}/resolve`);

// ── Premios ──
export const getPrizesOverview = () => apiClient.get('/rewards/admin/overview');
export const createPrize = (body) => apiClient.post('/rewards/admin', body);
export const updatePrize = (id, body) => apiClient.patch(`/rewards/admin/${id}`, body);
export const addPrizeStock = (id, amount) => apiClient.post(`/rewards/admin/${id}/stock`, { amount });
export const setCurrentPrize = (id) => apiClient.patch(`/rewards/admin/${id}/current`);
export const setDeliveriesPaused = (paused) => apiClient.patch('/rewards/admin/deliveries', { paused });
export const markDelivered = (redemptionId) => apiClient.patch(`/rewards/redemptions/${redemptionId}`, { status: 'DELIVERED' });
