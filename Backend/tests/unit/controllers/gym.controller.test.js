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
      user: { id: "user-123" },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
  });

  describe("checkIn", () => {
    it("devuelve 201 con sesión creada", async () => {
      const mockSession = {
        id: "session-123",
        userId: "user-123",
        checkInAt: new Date(),
        checkOutAt: null,
      };

      vi.spyOn(gymService, "checkIn").mockResolvedValue(mockSession);

      await gymController.checkIn(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          session: expect.any(Object),
        })
      );
    });

    it("llama next(err) si ya hay sesión activa", async () => {
      const error = new Error("User already has an active session");
      vi.spyOn(gymService, "checkIn").mockRejectedValue(error);

      await gymController.checkIn(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("checkOut", () => {
    it("devuelve 200 con sesión cerrada y durationMinutes", async () => {
      const mockSession = {
        id: "session-123",
        userId: "user-123",
        checkOutAt: new Date(),
        durationMinutes: 45,
      };

      vi.spyOn(gymService, "checkOut").mockResolvedValue(mockSession);

      await gymController.checkOut(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          session: expect.objectContaining({
            durationMinutes: 45,
          }),
        })
      );
    });

    it("llama next(err) si no hay sesión activa", async () => {
      const error = new Error("No active session");
      vi.spyOn(gymService, "checkOut").mockRejectedValue(error);

      await gymController.checkOut(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getPresentUsers", () => {
    it("devuelve 200 con lista de usuarios presentes", async () => {
      const mockUsers = [
        { id: "user-1", firstName: "John", minutesWaiting: 15 },
        { id: "user-2", firstName: "Jane", minutesWaiting: 30 },
      ];

      vi.spyOn(gymService, "getPresentUsers").mockResolvedValue(mockUsers);

      await gymController.getPresentUsers(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          users: mockUsers,
        })
      );
    });
  });

  describe("rateTrainer", () => {
    it("devuelve 201 con rating creado", async () => {
      req.body = { rating: 4 };
      req.params = { sessionId: "session-123", trainerId: "trainer-123" };

      const mockRating = {
        id: "rating-123",
        rating: 4,
        createdAt: new Date(),
      };

      vi.spyOn(gymService, "rateTrainer").mockResolvedValue(mockRating);

      await gymController.rateTrainer(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          rating: expect.any(Object),
        })
      );
    });

    it("llama next(err) con rating inválido", async () => {
      req.body = { rating: 6 };
      req.params = { sessionId: "session-123", trainerId: "trainer-123" };

      const error = new Error("Rating must be between 1 and 5");
      vi.spyOn(gymService, "rateTrainer").mockRejectedValue(error);

      await gymController.rateTrainer(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getSessionHistory", () => {
    it("devuelve 200 con historial paginado", async () => {
      req.query = { limit: "10", offset: "0" };

      const mockSessions = [
        { id: "session-1", checkInAt: new Date(), durationMinutes: 30 },
        { id: "session-2", checkInAt: new Date(), durationMinutes: 45 },
      ];

      vi.spyOn(gymService, "getSessionHistory").mockResolvedValue(mockSessions);

      await gymController.getSessionHistory(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          sessions: mockSessions,
        })
      );
    });
  });
});
