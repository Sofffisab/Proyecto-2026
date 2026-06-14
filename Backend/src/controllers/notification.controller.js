import * as notificationService from "../services/notification.service.js";

export async function getAll(req, res, next) {
  try {
    const data = await notificationService.getNotifications(
      req.user.id
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function markRead(req, res, next) {
  try {
    const data = await notificationService.markAsRead(
      req.params.id
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}