import { describe, it, expect, beforeEach, vi } from "vitest";
import * as notificationController from "../../../src/controllers/notification.controller.js";
import * as communicationService from "../../../src/services/communication.service.js";

vi.mock("../../../src/services/communication.service.js");

describe("NotificationController", () => {
  let req, res, next;

  beforeEach(() => {
    req = { user: { id: "user-1", role: "USER" }, params: {}, query: {} };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it("getNotifications defaults limit and offset when not provided", async () => {
    communicationService.getNotifications.mockResolvedValue([]);

    await notificationController.getNotifications(req, res, next);

    expect(communicationService.getNotifications).toHaveBeenCalledWith("user-1", {
      limit: 20,
      offset: 0,
    });
  });

  it("getNotifications forwards limit and offset from the query string", async () => {
    req.query = { limit: "5", offset: "10" };
    communicationService.getNotifications.mockResolvedValue([]);

    await notificationController.getNotifications(req, res, next);

    expect(communicationService.getNotifications).toHaveBeenCalledWith("user-1", {
      limit: 5,
      offset: 10,
    });
  });

  it("markAsRead marks the given notification as read for the caller", async () => {
    req.params.id = "notif-1";
    const updated = { id: "notif-1", read: true };
    communicationService.markAsRead.mockResolvedValue(updated);

    await notificationController.markAsRead(req, res, next);

    expect(communicationService.markAsRead).toHaveBeenCalledWith("notif-1", "user-1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: updated });
  });

  it("markAllAsRead marks every notification of the caller as read", async () => {
    communicationService.markAllAsRead.mockResolvedValue(undefined);

    await notificationController.markAllAsRead(req, res, next);

    expect(communicationService.markAllAsRead).toHaveBeenCalledWith("user-1");
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it("deleteNotification deletes the given notification owned by the caller", async () => {
    req.params.id = "notif-1";
    communicationService.deleteNotification.mockResolvedValue(undefined);

    await notificationController.deleteNotification(req, res, next);

    expect(communicationService.deleteNotification).toHaveBeenCalledWith("notif-1", "user-1");
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it("getUnreadCount returns the caller's unread notification count", async () => {
    communicationService.getUnreadCount.mockResolvedValue(4);

    await notificationController.getUnreadCount(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ success: true, data: { count: 4 } });
  });

  it("forwards service errors to next()", async () => {
    const error = new Error("boom");
    communicationService.getNotifications.mockRejectedValue(error);

    await notificationController.getNotifications(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it("markAsRead calls next(err) when the notification doesn't belong to the caller", async () => {
    req.params.id = "notif-1";
    const error = new Error("Forbidden");
    communicationService.markAsRead.mockRejectedValue(error);

    await notificationController.markAsRead(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it("markAllAsRead calls next(err) on service failure", async () => {
    const error = new Error("boom");
    communicationService.markAllAsRead.mockRejectedValue(error);

    await notificationController.markAllAsRead(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it("deleteNotification calls next(err) when the notification doesn't belong to the caller", async () => {
    req.params.id = "notif-1";
    const error = new Error("Forbidden");
    communicationService.deleteNotification.mockRejectedValue(error);

    await notificationController.deleteNotification(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it("getUnreadCount calls next(err) on service failure", async () => {
    const error = new Error("boom");
    communicationService.getUnreadCount.mockRejectedValue(error);

    await notificationController.getUnreadCount(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
