import * as communicationService from "../services/communication.service.js";

export async function getNotifications(req, res, next) {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const data = await communicationService.getNotifications(req.user.id, { limit, offset });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req, res, next) {
  try {
    // Pass userId so the service can verify ownership before updating
    const data = await communicationService.markAsRead(req.params.id, req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function markAllAsRead(req, res, next) {
  try {
    await communicationService.markAllAsRead(req.user.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function deleteNotification(req, res, next) {
  try {
    // Pass userId so the service can verify ownership before deleting
    await communicationService.deleteNotification(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function getUnreadCount(req, res, next) {
  try {
    const count = await communicationService.getUnreadCount(req.user.id);
    res.json({ success: true, data: { count } });
  } catch (err) {
    next(err);
  }
}