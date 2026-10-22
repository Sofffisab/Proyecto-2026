// src/api/services/notification.api.js
//
// Maps to Backend/src/routes/index.js "NOTIFICATIONS ROUTES" and
// Backend/src/controllers/notification.controller.js. These were already
// fully mounted server-side (unlike history/goals/assistance-history,
// which needed route registrations added) — this file was simply missing
// on the Frontend. The Backend already creates notifications for a wide
// range of events: points/badges (gamification.service.js), stale-goal
// nudges (suggestionEngine.service.js), routine requests (routine.service.js),
// reward delivery (reward.service.js), complaint outcomes
// (complaint.service.js), machine conflicts (machineConflict.service.js),
// and social challenge invites (jobs/challenge.job.js) — so this single
// generic list screen surfaces all of them.

import { apiClient } from '../client';

export function getNotifications() {
  return apiClient.get('/notifications');
}

export function getUnreadCount() {
  return apiClient.get('/notifications/unread-count');
}

export function markAsRead(notificationId) {
  return apiClient.patch(`/notifications/${notificationId}/read`);
}

export function markAllAsRead() {
  return apiClient.patch('/notifications/read-all');
}

export function deleteNotification(notificationId) {
  return apiClient.delete(`/notifications/${notificationId}`);
}
