import { describe, it, expect, vi, beforeEach } from "vitest";
import * as denunciaService from "../../../src/services/denuncia.service.js";
import * as gymService from "../../../src/services/gym.service.js";
import prisma from "../../../src/config/prisma.js";

vi.mock("../../../src/services/gym.service.js", () => ({ rateTrainer: vi.fn() }));

const T1 = "11111111-1111-4111-8111-111111111111";
const T2 = "22222222-2222-4222-8222-222222222222";
const M1 = "33333333-3333-4333-8333-333333333333";
const MACHINE = "44444444-4444-4444-8444-444444444444";

const session = {
  id: "s1",
  userId: "me",
  checkInAt: new Date("2026-11-01T10:00:00Z"),
  checkOutAt: new Date("2026-11-01T11:00:00Z"),
  dayRating: null,
};

function mockContext() {
  prisma.gymSession.findUnique.mockResolvedValue(session);
  prisma.gymSession.findMany.mockResolvedValue([
    { user: { id: T1, firstName: "Ana", lastName: "Gómez", role: "TRAINER" } },
    { user: { id: M1, firstName: "Luis", lastName: "Paz", role: "USER" } },
    { user: { id: "adm", firstName: "Root", lastName: "Admin", role: "ADMIN" } },
  ]);
  prisma.assistance.findMany.mockResolvedValue([{ trainer: { id: T2, firstName: "Bruno", lastName: "Díaz" } }]);
  prisma.trainerRating.findMany.mockResolvedValue([]);
  prisma.machine.findMany.mockResolvedValue([{ id: MACHINE, name: "Prensa", zone: null }]);
}

describe("DenunciaService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContext();
  });

  describe("getCheckoutContext", () => {
    it("lists who/what was in the gym during the visit, by role", async () => {
      const ctx = await denunciaService.getCheckoutContext("s1", "me");

      expect(ctx.trainersHelped).toEqual([{ id: T2, name: "Bruno Díaz", rated: false }]);
      // A trainer who helped counts as present even if their own session wasn't listed.
      expect(ctx.trainersPresent.map((t) => t.id).sort()).toEqual([T1, T2].sort());
      expect(ctx.members).toEqual([{ id: M1, name: "Luis Paz" }]);
      expect(ctx.machines).toHaveLength(1);
    });

    it("marks trainers that were already rated for this visit", async () => {
      prisma.trainerRating.findMany.mockResolvedValue([{ trainerId: T2 }]);
      const ctx = await denunciaService.getCheckoutContext("s1", "me");
      expect(ctx.trainersHelped[0].rated).toBe(true);
    });

    it("403 for somebody else's visit, 400 if the visit has not ended", async () => {
      await expect(denunciaService.getCheckoutContext("s1", "other")).rejects.toMatchObject({ statusCode: 403 });
      prisma.gymSession.findUnique.mockResolvedValue({ ...session, checkOutAt: null });
      await expect(denunciaService.getCheckoutContext("s1", "me")).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe("submitCheckoutFeedback", () => {
    it("saves the day rating, trainer ratings and one denuncia per item", async () => {
      prisma.denuncia.findFirst.mockResolvedValue(null);
      prisma.denuncia.create.mockImplementation(async ({ data }) => ({ id: "d", ...data }));
      gymService.rateTrainer.mockResolvedValue({});

      const res = await denunciaService.submitCheckoutFeedback("s1", "me", {
        dayRating: 4,
        trainerRatings: [{ trainerId: T2, rating: 5 }],
        denuncias: [
          { type: "TRAINER_MISCONDUCT", reportedUserId: T1, comment: " grosero " },
          { type: "MACHINE_BROKEN", machineId: MACHINE },
          { type: "MEMBER_MISCONDUCT", reportedUserId: M1 },
        ],
      });

      expect(prisma.gymSession.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { dayRating: 4 } });
      expect(gymService.rateTrainer).toHaveBeenCalledWith("s1", "me", T2, 5, true);
      expect(prisma.denuncia.create).toHaveBeenCalledTimes(3);
      expect(prisma.denuncia.create).toHaveBeenCalledWith({
        data: { reporterId: "me", gymSessionId: "s1", type: "TRAINER_MISCONDUCT", reportedUserId: T1, comment: "grosero" },
      });
      expect(prisma.denuncia.create).toHaveBeenCalledWith({
        data: { reporterId: "me", gymSessionId: "s1", type: "MACHINE_BROKEN", machineId: MACHINE, comment: null },
      });
      expect(res).toMatchObject({ dayRating: 4, denuncias: 3, ratings: [{ trainerId: T2, ok: true }] });
    });

    it("rejects a trainer or member who was not in the gym, saving nothing", async () => {
      const stranger = "99999999-9999-4999-8999-999999999999";
      await expect(
        denunciaService.submitCheckoutFeedback("s1", "me", {
          dayRating: 3,
          denuncias: [{ type: "TRAINER_FALSE_HELP", reportedUserId: stranger }],
        })
      ).rejects.toMatchObject({ statusCode: 400 });
      await expect(
        denunciaService.submitCheckoutFeedback("s1", "me", {
          denuncias: [{ type: "MEMBER_MISCONDUCT", reportedUserId: stranger }],
        })
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(prisma.gymSession.update).not.toHaveBeenCalled();
      expect(prisma.denuncia.create).not.toHaveBeenCalled();
    });

    it("rejects an unknown machine", async () => {
      await expect(
        denunciaService.submitCheckoutFeedback("s1", "me", {
          denuncias: [{ type: "MACHINE_BROKEN", machineId: "55555555-5555-4555-8555-555555555555" }],
        })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("does not store the same denuncia twice for the same visit", async () => {
      prisma.denuncia.findFirst.mockResolvedValue({ id: "already" });
      const res = await denunciaService.submitCheckoutFeedback("s1", "me", {
        denuncias: [{ type: "MACHINE_BROKEN", machineId: MACHINE }],
      });
      expect(prisma.denuncia.create).not.toHaveBeenCalled();
      expect(res.denuncias).toBe(0);
    });

    it("keeps going when one trainer rating fails (e.g. already rated)", async () => {
      gymService.rateTrainer.mockRejectedValue(new Error("You have already rated this trainer for this session"));
      const res = await denunciaService.submitCheckoutFeedback("s1", "me", {
        trainerRatings: [{ trainerId: T2, rating: 4 }],
      });
      expect(res.ratings[0]).toMatchObject({ trainerId: T2, ok: false });
    });
  });
});
