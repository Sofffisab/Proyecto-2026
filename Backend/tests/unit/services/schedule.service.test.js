import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "../../../src/config/prisma.js";
import * as schedule from "../../../src/services/schedule.service.js";
import * as exercises from "../../../src/services/exercise.service.js";

const row = (id, extra = {}) => ({
  id,
  slug: id,
  name: `Ejercicio ${id}`,
  nameEn: `Exercise ${id}`,
  description: "",
  descriptionEn: null,
  muscles: ["chest"],
  level: "BEGINNER",
  category: "STRENGTH",
  defaultSets: 3,
  defaultReps: "10-12",
  imageUrl: null,
  isCustom: false,
  active: true,
  ...extra,
});

describe("schedule.service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("validates date keys", () => {
    expect(schedule.isValidDateKey("2026-10-23")).toBe(true);
    expect(schedule.isValidDateKey("2026-02-30")).toBe(false);
    expect(schedule.isValidDateKey("23/10/2026")).toBe(false);
  });

  describe("saveScheduleDay", () => {
    it("stores a hand-built day in the database (upsert by user + date)", async () => {
      prisma.exercise.findMany.mockResolvedValue([row("a"), row("b")]);
      prisma.scheduleDay.upsert.mockImplementation(async ({ create }) => ({ id: "d1", ...create }));

      const day = await schedule.saveScheduleDay("u1", "2026-10-26", {
        title: "  Pecho  ",
        exercises: [
          { exerciseId: "a", sets: 4, reps: "8-10" },
          { exerciseId: "b", sets: 3, reps: 12 },
        ],
      });

      const call = prisma.scheduleDay.upsert.mock.calls[0][0];
      expect(call.where).toEqual({ userId_date: { userId: "u1", date: "2026-10-26" } });
      expect(call.create).toMatchObject({ title: "Pecho", source: "MANUAL" });
      expect(call.create.exercises).toEqual([
        { exerciseId: "a", sets: 4, reps: "8-10" },
        { exerciseId: "b", sets: 3, reps: "12" },
      ]);
      expect(day.exercises.map((e) => e.exercise.name)).toEqual(["Ejercicio a", "Ejercicio b"]);
      expect(day.estimatedMinutes).toBe(21);
    });

    it("rejects exercises that don't exist or belong to someone else", async () => {
      prisma.exercise.findMany.mockResolvedValue([row("a")]);
      await expect(
        schedule.saveScheduleDay("u1", "2026-10-26", { exercises: [{ exerciseId: "zzz", sets: 3, reps: "10" }] })
      ).rejects.toThrow("Exercise not found");
      expect(prisma.scheduleDay.upsert).not.toHaveBeenCalled();
    });
  });

  describe("getScheduleRange", () => {
    it("returns hydrated days with the exercises of each one", async () => {
      prisma.scheduleDay.findMany.mockResolvedValue([
        { id: "d1", date: "2026-10-26", title: "Pecho", source: "MANUAL", generalRoutineId: null, exercises: [{ exerciseId: "a", sets: 3, reps: "10" }] },
      ]);
      prisma.exercise.findMany.mockResolvedValue([row("a")]);

      const days = await schedule.getScheduleRange("u1", "2026-10-26", "2026-11-01");
      expect(days).toHaveLength(1);
      expect(days[0]).toMatchObject({ title: "Pecho", exerciseCount: 1 });
      expect(days[0].exercises[0].exercise.id).toBe("a");
    });

    it("rejects invalid or oversized ranges", async () => {
      await expect(schedule.getScheduleRange("u1", "x", "2026-10-01")).rejects.toThrow("YYYY-MM-DD");
      await expect(schedule.getScheduleRange("u1", "2026-10-10", "2026-10-01")).rejects.toThrow("after");
      await expect(schedule.getScheduleRange("u1", "2026-01-01", "2026-12-31")).rejects.toThrow("too large");
    });
  });

  describe("general routines", () => {
    it("lists them with counts and minutes", async () => {
      prisma.generalRoutine.findMany.mockResolvedValue([
        { id: "g1", slug: "chestDay", title: "Día de pecho", titleEn: "Chest day", level: null, exercises: [{ sets: 4 }, { sets: 3 }] },
      ]);
      const [r] = await schedule.listGeneralRoutines();
      expect(r).toMatchObject({ slug: "chestDay", exerciseCount: 2, estimatedMinutes: 21 });
    });

    it("returns one routine with its ordered exercises", async () => {
      prisma.generalRoutine.findFirst.mockResolvedValue({
        id: "g1", slug: "chestDay", title: "Día de pecho", titleEn: "Chest day", level: null,
        exercises: [{ exerciseId: "a", sets: 4, reps: "8-10", exercise: row("a") }],
      });
      const r = await schedule.getGeneralRoutine("chestDay");
      expect(r.exercises[0]).toMatchObject({ exerciseId: "a", sets: 4, reps: "8-10" });
      expect(r.exercises[0].exercise.name).toBe("Ejercicio a");
    });

    it("404s when it doesn't exist", async () => {
      prisma.generalRoutine.findFirst.mockResolvedValue(null);
      await expect(schedule.getGeneralRoutine("nope")).rejects.toThrow("not found");
    });
  });
});

describe("exercise.service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists built-in exercises plus the caller's own, with filters", async () => {
    prisma.exercise.findMany.mockResolvedValue([row("a")]);
    const result = await exercises.listExercises("u1", { muscle: "chest", q: " press " });
    const where = prisma.exercise.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain('"createdById":"u1"');
    expect(JSON.stringify(where)).toContain('"has":"chest"');
    expect(JSON.stringify(where)).toContain('"contains":"press"');
    expect(result.exercises[0]).toMatchObject({ id: "a", sets: 3, reps: "10-12" });
    expect(result.muscleGroups).toContain("legs");
  });

  it("creates a private custom exercise owned by the caller", async () => {
    prisma.exercise.count.mockResolvedValue(0);
    prisma.exercise.create.mockImplementation(async ({ data }) => row("c1", { ...data, defaultSets: data.defaultSets }));
    const created = await exercises.createCustomExercise("u1", { name: "Mi ejercicio", description: "x" });
    expect(prisma.exercise.create.mock.calls[0][0].data).toMatchObject({ isCustom: true, createdById: "u1" });
    expect(created.isCustom).toBe(true);
  });
});
