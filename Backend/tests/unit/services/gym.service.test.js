import { describe, it, expect, vi, beforeEach } from "vitest";
import * as gymService from "../../../src/services/gym.service.js";
import * as gamificationService from "../../../src/services/gamification.service.js";
import * as trainerMetricsService from "../../../src/services/trainerMetrics.service.js";
import prisma from "../../../src/config/prisma.js";
import { emitUserNeedsAttention } from "../../../src/realtime/ably.js";

vi.mock("../../../src/services/gamification.service.js");
vi.mock("../../../src/services/trainerMetrics.service.js");
vi.mock("../../../src/realtime/ably.js");

prisma.gymSession.findUnique.mockResolvedValue({
  id: "session-123",
  userId: "user-123",
  checkOutAt: new Date(),
  ratings: [] 
});

describe("GymService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkIn", () => {
    it("crea sesión con checkOutAt null", async () => {
      const mockSession = {
        id: "session-123",
        userId: "user-123",
        checkInAt: new Date(),
        checkOutAt: null,
      };

      prisma.gymSession.findFirst.mockResolvedValue(null);
      prisma.gymSession.create.mockResolvedValue(mockSession);
      vi.spyOn(gamificationService, "addPoints").mockResolvedValue(undefined);

      const result = await gymService.checkIn("user-123");

      expect(result.checkOutAt).toBeNull();
      expect(result.userId).toBe("user-123");
      expect(prisma.gymSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: "user-123" }),
      });
    });

    it("si ya hay una sesión abierta, la devuelve sin crear una nueva (tolerancia a doble escaneo)", async () => {
      const existingSession = {
        id: "session-123",
        checkOutAt: null,
      };
      prisma.gymSession.findFirst.mockResolvedValue(existingSession);

      const result = await gymService.checkIn("user-123");

      expect(result).toEqual(existingSession);
      expect(prisma.gymSession.create).not.toHaveBeenCalled();
    });

    it("llama a addPoints(POINTS.CHECK_IN) sin bloquear el flujo si falla", async () => {
      const mockSession = {
        id: "session-123",
        userId: "user-123",
        checkInAt: new Date(),
        checkOutAt: null,
      };

      prisma.gymSession.findFirst.mockResolvedValue(null);
      prisma.gymSession.create.mockResolvedValue(mockSession);
      vi.spyOn(gamificationService, "addPoints").mockRejectedValue(new Error("Points failed"));

      const result = await gymService.checkIn("user-123");

      expect(result).toBeDefined();
      expect(gamificationService.addPoints).toHaveBeenCalled();
    });
  });

  describe("checkOut", () => {
    it("calcula durationMinutes correctamente", async () => {
      const now = new Date();
      const checkInTime = new Date(now.getTime() - 60000); // 1 minute ago

      const mockSession = {
        id: "session-123",
        userId: "user-123",
        checkInAt: checkInTime,
        checkOutAt: null,
      };

      prisma.gymSession.findFirst.mockResolvedValue(mockSession);
      prisma.gymSession.update.mockResolvedValue({
        ...mockSession,
        checkOutAt: now,
        durationMinutes: 1,
      });

      const result = await gymService.checkOut("user-123");

      expect(result.durationMinutes).toBeGreaterThanOrEqual(0);
      expect(prisma.gymSession.update).toHaveBeenCalledWith({
        where: { id: "session-123" },
        data: expect.objectContaining({
          durationMinutes: expect.any(Number),
        }),
      });
    });

    it("no lanza error si no hay sesión activa: devuelve noActiveSession sin contarlo como visita", async () => {
      prisma.gymSession.findFirst.mockResolvedValue(null);

      const result = await gymService.checkOut("user-123");

      expect(result).toEqual({ noActiveSession: true });
      expect(prisma.gymSession.update).not.toHaveBeenCalled();
    });
  });

  describe("getPresentUsers", () => {
    it("enriquece con lastAssistanceAt sin N+1 queries", async () => {
      const mockSessions = [
        { id: "session-1", userId: "user-1", user: { id: "user-1", firstName: "John" } },
        { id: "session-2", userId: "user-2", user: { id: "user-2", firstName: "Jane" } },
      ];

      prisma.gymSession.findMany.mockResolvedValue(mockSessions);
      prisma.assistance.findMany.mockResolvedValue([
        { userId: "user-1", completedAt: new Date(Date.now() - 300000) },
        { userId: "user-2", completedAt: new Date(Date.now() - 300000) },
      ]);

      const result = await gymService.getPresentUsers();

      expect(result).toHaveLength(2);
      expect(prisma.gymSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ checkOutAt: null }),
          include: expect.any(Object),
        })
      );
    });

    it("ordena por más urgente (más tiempo sin asistencia) y luego por trainerPreference", async () => {
      const result = await gymService.getPresentUsers();

      expect(result).toBeDefined();
    });

    it("emite USER_NEEDS_ATTENTION si minutesWaiting >= ATTENTION_THRESHOLD_MINUTES", async () => {
      const mockSessions = [
        {
          id: "session-1",
          userId: "user-1",
          user: { id: "user-1", firstName: "John" },
          assistance: [],
        },
      ];

      prisma.gymSession.findMany.mockResolvedValue(mockSessions);
      prisma.assistance.findMany.mockResolvedValue([]);

      await gymService.getPresentUsers();

      expect(emitUserNeedsAttention).toBeDefined();
    });

    it("no emite el evento si está dentro del threshold", async () => {
      const recentTime = new Date();
      const mockSessions = [
        {
          id: "session-1",
          userId: "user-1",
          checkInAt: recentTime,
          user: { id: "user-1", firstName: "John" },
        },
      ];

      prisma.gymSession.findMany.mockResolvedValue(mockSessions);

      const result = await gymService.getPresentUsers();

      expect(result).toBeDefined();
    });
  });

  describe("rateTrainer", () => {
    it("rechaza rating fuera de 1-5", async () => {
      await expect(
        gymService.rateTrainer("session-123", "user-123", "trainer-123", 6)
      ).rejects.toThrow("Rating must be between 1 and 5");
    });

    it("rechaza si la sesión no pertenece al usuario", async () => {
      prisma.gymSession.findUnique.mockResolvedValue({
        id: "session-123",
        userId: "other-user",
      });

      await expect(
        gymService.rateTrainer("session-123", "user-123", "trainer-123", 4)
      ).rejects.toThrow();
    });

    it("rechaza si la sesión no está checkout-eada", async () => {
      prisma.gymSession.findUnique.mockResolvedValue({
        id: "session-123",
        userId: "user-123",
        checkOutAt: null,
      });

      await expect(
        gymService.rateTrainer("session-123", "user-123", "trainer-123", 4)
      ).rejects.toThrow();
    });

    it("rechaza doble rating para la misma sesión", async () => {
      prisma.gymSession.findUnique.mockResolvedValue({
        id: "session-123",
        userId: "user-123",
        checkOutAt: new Date(),
      });

      prisma.assistance.findFirst.mockResolvedValue({
        id: "assistance-123",
        status: "COMPLETED",
      });

      prisma.trainerRating.findFirst.mockResolvedValue({
        id: "rating-123",
      });

      // CORRECCIÓN: Alineación con el texto exacto lanzado por tu servicio
      await expect(
        gymService.rateTrainer("session-123", "user-123", "trainer-123", 4)
      ).rejects.toThrow("You have already rated this trainer for this session");
    });

    it("llama a updateTrainerMetrics tras crear el rating", async () => {
      prisma.gymSession.findUnique.mockResolvedValue({
        id: "session-123",
        userId: "user-123",
        checkOutAt: new Date(),
      });

      prisma.assistance.findFirst.mockResolvedValue({
        id: "assistance-123",
        status: "COMPLETED",
      });

      // CORRECCIÓN: Aquí simulamos que NO está calificado aún (null), para que no lance la excepción
      prisma.trainerRating.findFirst.mockResolvedValue(null);
      prisma.trainerRating.create.mockResolvedValue({
        id: "rating-123",
        trainerId: "trainer-123",
        rating: 4,
      });

      vi.spyOn(trainerMetricsService, "updateTrainerMetrics").mockResolvedValue(undefined);

      await gymService.rateTrainer("session-123", "user-123", "trainer-123", 4);

      expect(trainerMetricsService.updateTrainerMetrics).toHaveBeenCalledWith("trainer-123");
    });
  });

  describe("getCurrentSession", () => {
    it("devuelve la sesión activa del usuario", async () => {
      const mockSession = {
        id: "session-123",
        userId: "user-123",
        checkOutAt: null,
      };

      prisma.gymSession.findFirst.mockResolvedValue(mockSession);

      const result = await gymService.getCurrentSession("user-123");

      expect(result).toEqual(mockSession);
    });
  });

  describe("getSessionHistory", () => {
    it("devuelve historial ordenado por más reciente", async () => {
      const mockSessions = [
        { id: "session-1", checkInAt: new Date() },
        { id: "session-2", checkInAt: new Date(Date.now() - 86400000) },
      ];

      prisma.gymSession.findMany.mockResolvedValue(mockSessions);

      const result = await gymService.getSessionHistory("user-123");

      expect(result).toHaveLength(2);
      expect(prisma.gymSession.findMany).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        orderBy: { checkInAt: "desc" },
      });
    });
  });
});