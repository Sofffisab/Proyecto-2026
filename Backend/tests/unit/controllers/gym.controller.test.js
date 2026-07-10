import { describe, it, expect, vi, beforeEach } from "vitest";
import * as gymController from "../../../src/controllers/gym.controller.js";
import * as gymService from "../../../src/services/gym.service.js";

vi.mock("../../../src/services/gym.service.js");

describe("GymController", () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      body: {},
      params: {},
      validatedData: {},
      user: { id: "user-123" },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
  });

  describe("checkIn", () => {
    it("returns the created session", async () => {
      const mockSession = {
        id: "session-123",
        userId: "user-123",
        checkInAt: new Date(),
        checkOutAt: null,
      };

      vi.spyOn(gymService, "checkIn").mockResolvedValue(mockSession);

      await gymController.checkIn(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockSession });
    });

    it("calls next(err) if there is already an active session", async () => {
      const error = new Error("User already has an active session");
      vi.spyOn(gymService, "checkIn").mockRejectedValue(error);

      await gymController.checkIn(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("checkOut", () => {
    it("returns the closed session with durationMinutes", async () => {
      const mockSession = {
        id: "session-123",
        userId: "user-123",
        checkOutAt: new Date(),
        durationMinutes: 45,
      };

      vi.spyOn(gymService, "checkOut").mockResolvedValue(mockSession);

      await gymController.checkOut(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockSession });
    });

    it("calls next(err) if there is no active session", async () => {
      const error = new Error("No active session");
      vi.spyOn(gymService, "checkOut").mockRejectedValue(error);

      await gymController.checkOut(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("presentUsers", () => {
    it("returns the list of present users", async () => {
      const mockUsers = [
        { id: "user-1", firstName: "John", minutesWaiting: 15 },
        { id: "user-2", firstName: "Jane", minutesWaiting: 30 },
      ];

      vi.spyOn(gymService, "getPresentUsers").mockResolvedValue(mockUsers);

      await gymController.presentUsers(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUsers });
    });
  });

  describe("rateTrainer", () => {
    it("returns the created rating", async () => {
      req.params = { id: "session-123" };
      req.validatedData = { trainerId: "trainer-123", rating: 4, helped: true, comment: undefined };

      const mockResult = { rating: { id: "rating-123", rating: 4, createdAt: new Date() }, complaint: null };

      vi.spyOn(gymService, "rateTrainer").mockResolvedValue(mockResult);

      await gymController.rateTrainer(req, res, next);

      expect(gymService.rateTrainer).toHaveBeenCalledWith(
        "session-123",
        "user-123",
        "trainer-123",
        4,
        true,
        undefined
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });

    it("passes helped=false and comment through when the member marks 'No me ayudaron'", async () => {
      req.params = { id: "session-123" };
      req.validatedData = { trainerId: "trainer-123", rating: 2, helped: false, comment: "Nunca se acercó" };

      const mockResult = {
        rating: { id: "rating-123", rating: 2 },
        complaint: { id: "complaint-123", source: "AUTO_NO_HELP" },
      };

      vi.spyOn(gymService, "rateTrainer").mockResolvedValue(mockResult);

      await gymController.rateTrainer(req, res, next);

      expect(gymService.rateTrainer).toHaveBeenCalledWith(
        "session-123",
        "user-123",
        "trainer-123",
        2,
        false,
        "Nunca se acercó"
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });

    it("calls next(err) with an invalid rating", async () => {
      req.params = { id: "session-123" };
      req.validatedData = { trainerId: "trainer-123", rating: 6 };

      const error = new Error("Rating must be between 1 and 5");
      vi.spyOn(gymService, "rateTrainer").mockRejectedValue(error);

      await gymController.rateTrainer(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getSessionHistory", () => {
    it("returns the session history", async () => {
      const mockSessions = [
        { id: "session-1", checkInAt: new Date(), durationMinutes: 30 },
        { id: "session-2", checkInAt: new Date(), durationMinutes: 45 },
      ];

      vi.spyOn(gymService, "getSessionHistory").mockResolvedValue(mockSessions);

      await gymController.getSessionHistory(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockSessions });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("DB error");
      vi.spyOn(gymService, "getSessionHistory").mockRejectedValue(error);

      await gymController.getSessionHistory(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getSessionById", () => {
    it("returns 200 with the session when found", async () => {
      req.params = { id: "session-1" };
      const mockSession = { id: "session-1", userId: "user-123" };
      vi.spyOn(gymService, "getSessionById").mockResolvedValue(mockSession);

      await gymController.getSessionById(req, res, next);

      expect(gymService.getSessionById).toHaveBeenCalledWith("session-1", "user-123");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockSession });
    });

    it("returns 404 when the session does not exist", async () => {
      req.params = { id: "does-not-exist" };
      vi.spyOn(gymService, "getSessionById").mockResolvedValue(null);

      await gymController.getSessionById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: "Session not found" });
    });

    it("calls next(err) on failure", async () => {
      req.params = { id: "session-1" };
      const error = new Error("DB error");
      vi.spyOn(gymService, "getSessionById").mockRejectedValue(error);

      await gymController.getSessionById(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("priorityAssistanceList", () => {
    it("returns 200 with the members waiting the longest for assistance", async () => {
      const mockList = [{ id: "user-1", minutesWaiting: 20 }];
      vi.spyOn(gymService, "getPriorityAssistanceList").mockResolvedValue(mockList);

      await gymController.priorityAssistanceList(req, res, next);

      expect(gymService.getPriorityAssistanceList).toHaveBeenCalledWith("user-123");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockList });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("DB error");
      vi.spyOn(gymService, "getPriorityAssistanceList").mockRejectedValue(error);

      await gymController.priorityAssistanceList(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getGymStatus", () => {
    it("returns isCheckedIn=true with the active session when one exists", async () => {
      const mockSession = { id: "session-1", checkInAt: new Date() };
      vi.spyOn(gymService, "getCurrentSession").mockResolvedValue(mockSession);

      await gymController.getGymStatus(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { isCheckedIn: true, session: mockSession },
      });
    });

    it("returns isCheckedIn=false with a null session when there is none", async () => {
      vi.spyOn(gymService, "getCurrentSession").mockResolvedValue(null);

      await gymController.getGymStatus(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { isCheckedIn: false, session: null },
      });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("DB error");
      vi.spyOn(gymService, "getCurrentSession").mockRejectedValue(error);

      await gymController.getGymStatus(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
