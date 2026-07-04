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
    it("devuelve la sesión creada", async () => {
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

    it("llama next(err) si ya hay sesión activa", async () => {
      const error = new Error("User already has an active session");
      vi.spyOn(gymService, "checkIn").mockRejectedValue(error);

      await gymController.checkIn(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("checkOut", () => {
    it("devuelve la sesión cerrada con durationMinutes", async () => {
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

    it("llama next(err) si no hay sesión activa", async () => {
      const error = new Error("No active session");
      vi.spyOn(gymService, "checkOut").mockRejectedValue(error);

      await gymController.checkOut(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("presentUsers", () => {
    it("devuelve la lista de usuarios presentes", async () => {
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
    it("devuelve el rating creado", async () => {
      req.params = { id: "session-123" };
      req.validatedData = { trainerId: "trainer-123", rating: 4 };

      const mockRating = { id: "rating-123", rating: 4, createdAt: new Date() };

      vi.spyOn(gymService, "rateTrainer").mockResolvedValue(mockRating);

      await gymController.rateTrainer(req, res, next);

      expect(gymService.rateTrainer).toHaveBeenCalledWith(
        "session-123",
        "user-123",
        "trainer-123",
        4
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockRating });
    });

    it("llama next(err) con rating inválido", async () => {
      req.params = { id: "session-123" };
      req.validatedData = { trainerId: "trainer-123", rating: 6 };

      const error = new Error("Rating must be between 1 and 5");
      vi.spyOn(gymService, "rateTrainer").mockRejectedValue(error);

      await gymController.rateTrainer(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getSessionHistory", () => {
    it("devuelve el historial de sesiones", async () => {
      const mockSessions = [
        { id: "session-1", checkInAt: new Date(), durationMinutes: 30 },
        { id: "session-2", checkInAt: new Date(), durationMinutes: 45 },
      ];

      vi.spyOn(gymService, "getSessionHistory").mockResolvedValue(mockSessions);

      await gymController.getSessionHistory(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockSessions });
    });
  });
});
