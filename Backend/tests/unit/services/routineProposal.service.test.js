import { describe, it, expect, vi, beforeEach } from "vitest";
import * as routineService from "../../../src/services/routine.service.js";
import { prisma } from "../../../src/config/prisma.js";

const exercises = [
  { exerciseId: "e1", sets: 3, reps: "10" },
  { exerciseId: "e2", sets: 4, reps: "8-10" },
];

describe("Routine built by a trainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.notification.create.mockResolvedValue({});
  });

  describe("createRoutineRequest", () => {
    it("does not allow a second request while one is in progress", async () => {
      prisma.routineRequest.findFirst.mockResolvedValue({ id: "open", status: "ACCEPTED" });
      await expect(routineService.createRoutineRequest("u1")).rejects.toThrow("already have a routine request");
      expect(prisma.routineRequest.create).not.toHaveBeenCalled();
    });
  });

  describe("proposeRoutine", () => {
    const request = {
      id: "req1",
      userId: "u1",
      trainerId: "t1",
      status: "ACCEPTED",
      user: { id: "u1", firstName: "Ana", lastName: "Paz" },
      trainer: { id: "t1", firstName: "Tina", lastName: "Ruiz" },
    };

    it("stores the routine, marks it PROPOSED and notifies the member", async () => {
      prisma.routineRequest.findUnique.mockResolvedValue(request);
      prisma.exercise.findMany.mockResolvedValue([{ id: "e1" }, { id: "e2" }]);
      prisma.routineRequest.update.mockResolvedValue({ id: "req1", status: "PROPOSED" });

      await routineService.proposeRoutine("req1", "t1", { name: "Fuerza base", exercises });

      expect(prisma.routineRequest.update).toHaveBeenCalledWith({
        where: { id: "req1" },
        data: expect.objectContaining({ status: "PROPOSED", proposedName: "Fuerza base", proposedExercises: exercises }),
      });
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: "u1", body: expect.stringContaining("¿la aceptás?") }) })
      );
    });

    it("only the trainer who took the request can send the routine", async () => {
      prisma.routineRequest.findUnique.mockResolvedValue(request);
      await expect(routineService.proposeRoutine("req1", "other", { name: "x", exercises })).rejects.toThrow("not assigned to you");
    });

    it("needs the request to be accepted first", async () => {
      prisma.routineRequest.findUnique.mockResolvedValue({ ...request, status: "PENDING" });
      await expect(routineService.proposeRoutine("req1", "t1", { name: "x", exercises })).rejects.toThrow("Accept the request");
    });

    it("rejects exercises that are not in the built-in catalog", async () => {
      prisma.routineRequest.findUnique.mockResolvedValue(request);
      prisma.exercise.findMany.mockResolvedValue([{ id: "e1" }]); // e2 missing / custom
      await expect(routineService.proposeRoutine("req1", "t1", { name: "x", exercises })).rejects.toThrow("does not exist");
      expect(prisma.routineRequest.update).not.toHaveBeenCalled();
    });
  });

  describe("respondToProposal", () => {
    const proposed = {
      id: "req1",
      userId: "u1",
      trainerId: "t1",
      status: "PROPOSED",
      proposedName: "Fuerza base",
      proposedExercises: exercises,
      user: { id: "u1", firstName: "Ana", lastName: "Paz", trainingLevel: "BEGINNER" },
      trainer: { id: "t1", firstName: "Tina", lastName: "Ruiz" },
    };

    function mockTx() {
      const tx = {
        generalRoutine: { create: vi.fn().mockResolvedValue({ id: "gr1" }) },
        scheduleDay: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn(), update: vi.fn() },
        routineRequest: { update: vi.fn() },
      };
      prisma.$transaction.mockImplementation((fn) => fn(tx));
      return tx;
    }

    beforeEach(() => {
      prisma.exercise.findMany.mockResolvedValue([
        { id: "e1", name: "Sentadilla", isCustom: false, createdById: null, active: true },
        { id: "e2", name: "Press", isCustom: false, createdById: null, active: true },
      ]);
    });

    it("accepting saves it in the member's own routines AND in today's routine", async () => {
      prisma.routineRequest.findUnique.mockResolvedValue(proposed);
      const tx = mockTx();

      const result = await routineService.respondToProposal("req1", "u1", { accept: true, date: "2026-11-08" });

      expect(result).toMatchObject({ accepted: true, generalRoutineId: "gr1" });
      expect(tx.generalRoutine.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ ownerUserId: "u1", createdByTrainerId: "t1", title: "Fuerza base" }),
      });
      expect(tx.scheduleDay.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: "u1", date: "2026-11-08", generalRoutineId: "gr1", exercises }),
      });
      expect(tx.routineRequest.update).toHaveBeenCalledWith({
        where: { id: "req1" },
        data: expect.objectContaining({ status: "COMPLETED", generalRoutineId: "gr1" }),
      });
    });

    it("adds to a day that already has a routine instead of replacing it", async () => {
      prisma.routineRequest.findUnique.mockResolvedValue(proposed);
      const tx = mockTx();
      tx.scheduleDay.findUnique.mockResolvedValue({
        id: "day1",
        exercises: [{ exerciseId: "e1", sets: 5, reps: "5" }, { exerciseId: "e9", sets: 3, reps: "12" }],
      });

      await routineService.respondToProposal("req1", "u1", { accept: true, date: "2026-11-08" });

      expect(tx.scheduleDay.create).not.toHaveBeenCalled();
      const { data } = tx.scheduleDay.update.mock.calls[0][0];
      expect(data.exercises.map((e) => e.exerciseId)).toEqual(["e1", "e9", "e2"]); // e1 not duplicated
    });

    it("declining keeps nothing in the account and tells the trainer", async () => {
      prisma.routineRequest.findUnique.mockResolvedValue(proposed);
      prisma.routineRequest.update.mockResolvedValue({});

      const result = await routineService.respondToProposal("req1", "u1", { accept: false });

      expect(result).toEqual({ accepted: false });
      expect(prisma.routineRequest.update).toHaveBeenCalledWith({
        where: { id: "req1" },
        data: expect.objectContaining({ status: "DECLINED" }),
      });
      expect(prisma.generalRoutine.create).not.toHaveBeenCalled();
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: "t1" }) })
      );
    });

    it("only the member the routine was built for can answer", async () => {
      prisma.routineRequest.findUnique.mockResolvedValue(proposed);
      await expect(routineService.respondToProposal("req1", "intruder", { accept: true, date: "2026-11-08" })).rejects.toThrow("Forbidden");
    });

    it("cannot answer twice", async () => {
      prisma.routineRequest.findUnique.mockResolvedValue({ ...proposed, status: "COMPLETED" });
      await expect(routineService.respondToProposal("req1", "u1", { accept: true, date: "2026-11-08" })).rejects.toThrow("no routine waiting");
    });

    it("needs a valid day to accept", async () => {
      prisma.routineRequest.findUnique.mockResolvedValue(proposed);
      await expect(routineService.respondToProposal("req1", "u1", { accept: true, date: "mañana" })).rejects.toThrow();
    });
  });
});
