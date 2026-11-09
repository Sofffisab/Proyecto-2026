import { describe, it, expect, vi, beforeEach } from "vitest";
import * as assistanceService from "../../../src/services/assistance.service.js";
import * as gymOverview from "../../../src/services/gymOverview.service.js";
import * as rewardService from "../../../src/services/reward.service.js";
import { prisma } from "../../../src/config/prisma.js";

describe("Trainer help in the gym", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("startAssistance", () => {
    it("refuses when the person is not in the gym", async () => {
      prisma.gymSession.findFirst.mockResolvedValue(null);
      await expect(assistanceService.startAssistance("t1", "u1")).rejects.toThrow("not in the gym");
    });

    it("does not step on a colleague who is already helping", async () => {
      prisma.gymSession.findFirst.mockResolvedValue({ id: "s1" });
      prisma.assistance.findFirst.mockResolvedValue({ id: "a1", status: "ASSIGNED", trainerId: "t2" });
      await expect(assistanceService.startAssistance("t1", "u1")).rejects.toThrow("Another trainer");
    });

    it("starting twice returns the help already in progress", async () => {
      prisma.gymSession.findFirst.mockResolvedValue({ id: "s1" });
      prisma.assistance.findFirst.mockResolvedValue({ id: "a1", status: "ASSIGNED", trainerId: "t1" });
      await expect(assistanceService.startAssistance("t1", "u1")).resolves.toMatchObject({ id: "a1" });
      expect(prisma.assistance.create).not.toHaveBeenCalled();
    });

    it("with no request pending, creates a help that starts already assigned", async () => {
      prisma.gymSession.findFirst.mockResolvedValue({ id: "s1" });
      prisma.assistance.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ role: "TRAINER", isActive: true, firstName: "Ana" });
      prisma.machineUsage.findFirst.mockResolvedValue({ machineId: "m1" });
      prisma.assistance.create.mockResolvedValue({ id: "a2", status: "ASSIGNED", userId: "u1" });

      await assistanceService.startAssistance("t1", "u1");

      expect(prisma.assistance.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: "u1", trainerId: "t1", status: "ASSIGNED", machineId: "m1" }),
      });
    });
  });

  describe("getPeopleInGym", () => {
    it("lists people asking for help first and hides who opted out of assistance (unless they asked)", async () => {
      const at = (min) => new Date(Date.now() - min * 60000);
      const session = (userId, name, settings = {}) => ({
        userId,
        checkInAt: at(30),
        user: { id: userId, firstName: name, lastName: "X", email: `${name}@g.com`, profilePhoto: null, settings },
      });
      prisma.gymSession.findMany.mockResolvedValue([
        session("u1", "Zoe"),
        session("u2", "Ana"),
        session("u3", "Luz", { disableAssistance: true }),
        session("u4", "Eva", { disableAssistance: true }), // opted out but pressed the button
      ]);
      prisma.assistance.findMany
        .mockResolvedValueOnce([{ id: "a4", userId: "u4", requestedAt: at(5) }]) // pending
        .mockResolvedValueOnce([]); // assisted by me
      prisma.machineUsage.findMany.mockResolvedValue([]);

      const people = await gymOverview.getPeopleInGym("t1");

      expect(people.map((p) => p.id)).toEqual(["u4", "u2", "u1"]);
      expect(people[0]).toMatchObject({ needsHelp: true, pendingAssistanceId: "a4" });
      expect(people.every((p) => p.medical === undefined && p.medicalConditions === undefined)).toBe(true);
    });
  });

  describe("getPersonInGym", () => {
    it("never returns another trainer's private notes", async () => {
      prisma.gymSession.findFirst.mockResolvedValue({ id: "s1" });
      prisma.user.findUnique.mockResolvedValue({ id: "u1", firstName: "Ana", lastName: "P", role: "USER", medicalConditions: ["Asma"], objectives: [], trainingLevel: "BEGINNER" });
      prisma.assistance.findFirst.mockResolvedValue(null);
      prisma.trainerNote.findMany.mockResolvedValue([]);

      const person = await gymOverview.getPersonInGym("t1", "u1");

      expect(person.medical).toEqual(["Asma"]);
      expect(prisma.trainerNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "u1", OR: [{ trainerId: "t1" }, { visibility: "PUBLIC" }] } })
      );
    });
  });
});

describe("Prize deliveries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("while paused nothing is shipped: a qualifying member is queued instead", async () => {
    prisma.gymSettings.findUnique.mockResolvedValue({ rewardDeliveriesPaused: true });
    prisma.pointTransaction.aggregate.mockResolvedValue({ _sum: { points: 900 } });
    prisma.reward.findFirst.mockResolvedValue({ id: "r1" });
    prisma.rewardPendingGrant.findFirst.mockResolvedValue(null);
    prisma.rewardPendingGrant.create.mockResolvedValue({});

    const result = await rewardService.autoGrantRewards("u1");

    expect(result).toBeNull();
    expect(prisma.rewardRedemption.create).not.toHaveBeenCalled();
    expect(prisma.reward.update).not.toHaveBeenCalled();
  });

  it("adding stock raises both the units left and the total ever stocked", async () => {
    prisma.reward.findUnique.mockResolvedValue({ id: "r1", name: "Toalla" });
    prisma.reward.update.mockResolvedValue({ id: "r1" });
    prisma.rewardPendingGrant.findMany.mockResolvedValue([]);

    await rewardService.addStock("admin-1", "r1", 20);

    expect(prisma.reward.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { stock: { increment: 20 }, totalStock: { increment: 20 } },
    });
    expect(prisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "REWARD_STOCK_ADDED", metadata: { prize: "Toalla", amount: 20 } }) })
    );
  });

  it("only one prize can be the current one", async () => {
    prisma.reward.findUnique.mockResolvedValue({ id: "r2", name: "Banda" });
    prisma.reward.updateMany.mockResolvedValue({});
    prisma.reward.update.mockResolvedValue({});

    await rewardService.setCurrentReward("admin-1", "r2");

    expect(prisma.reward.updateMany).toHaveBeenCalledWith({ where: { isCurrent: true }, data: { isCurrent: false } });
    expect(prisma.reward.update).toHaveBeenCalledWith({ where: { id: "r2" }, data: { isCurrent: true } });
  });
});
