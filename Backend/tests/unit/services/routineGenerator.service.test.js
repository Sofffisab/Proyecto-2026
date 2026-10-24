import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "../../../src/config/prisma.js";
import * as generator from "../../../src/services/routineGenerator.service.js";
import * as behavior from "../../../src/services/behaviorAnalysis.service.js";
import { EXERCISES } from "../../../prisma/seedData/catalog.js";

// Catalog rows shaped like the Prisma Exercise model (id = slug for readability).
const catalog = EXERCISES.map((e) => ({
  id: e.slug,
  slug: e.slug,
  name: e.name,
  nameEn: e.nameEn,
  description: e.description,
  descriptionEn: e.descriptionEn,
  muscles: e.muscles,
  machineKeywords: e.machineKeywords,
  level: e.level,
  category: e.category,
  defaultSets: e.sets,
  defaultReps: e.reps,
  imageUrl: null,
  isCustom: false,
  active: true,
}));
const byId = Object.fromEntries(catalog.map((e) => [e.id, e]));

const NOW = new Date(2026, 9, 23, 12, 0, 0); // Friday
// Monday / Wednesday / Friday of the following week.
const MON = "2026-10-26";
const WED = "2026-10-28";
const FRI = "2026-10-30";

const HABIT = {
  1: ["Bench Press", "Press Declinado", "Pec Deck", "Polea Alta"],
  3: ["Jalón al Pecho", "Remo Sentado", "Polea Alta"],
  5: ["Prensa de Piernas", "Extensión de Cuádriceps", "Curl Femoral", "Cinta de Correr"],
};

function habitSessions(weeks = 8) {
  const sessions = [];
  for (let offset = weeks * 7; offset >= 1; offset--) {
    const day = new Date(2026, 9, 23 - offset, 18, 0, 0);
    const names = HABIT[day.getDay()];
    if (!names) continue;
    sessions.push({
      checkInAt: day,
      durationMinutes: 60,
      machineUsages: names.map((name) => ({ startedAt: day, machine: { name } })),
    });
  }
  return sessions;
}

const baseUser = {
  trainingLevel: "INTERMEDIATE",
  objectives: ["GAIN_MUSCLE"],
  weeklyTrainingDays: "THREE",
  trainingType: "STRENGTH",
};

const patterns = {
  avgSessionsPerWeek: 3,
  preferredHour: 18,
  routines: [{ signature: ["Bench Press", "Pec Deck", "Polea Alta", "Press Declinado"], occurrences: 8 }],
};

describe("routineGenerator.service", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("machineMatchesExercise", () => {
    it("matches by keyword ignoring case and accents", () => {
      expect(generator.machineMatchesExercise("Jalón al Pecho", ["jalon"])).toBe(true);
      expect(generator.machineMatchesExercise("CINTA DE CORRER", ["cinta"])).toBe(true);
    });
    it("does not match unrelated machines", () => {
      expect(generator.machineMatchesExercise("Bench Press", ["cinta", "treadmill"])).toBe(false);
    });
  });

  describe("learning from history", () => {
    const profile = generator.buildTrainingProfile({
      user: baseUser,
      catalog,
      sessions: habitSessions(),
      patterns,
      now: NOW,
    });

    it("learns something and reads the member's real session length", () => {
      expect(profile.learned).toBe(true);
      expect(profile.sessionMinutes).toBe(60);
      expect(profile.topMachines.length).toBeGreaterThan(0);
    });

    it("respects the weekday habit: Mon=push, Wed=pull, Fri=legs", () => {
      const plan = generator.planDays(profile, [MON, WED, FRI], "es");
      expect(plan.map((d) => d.focus)).toEqual(["PUSH", "PULL", "LEGS"]);
      expect(plan.every((d) => d.basedOn === "WEEKDAY_PATTERN")).toBe(true);
    });

    it("builds the day from exercises the member's machines map to", () => {
      const [monday] = generator.planDays(profile, [MON], "es");
      const ids = monday.exercises.map((e) => e.exerciseId);
      expect(ids.some((id) => ["benchPress", "declinePress", "pecDeck"].includes(id))).toBe(true);
      const muscles = ids.flatMap((id) => byId[id].muscles);
      expect(muscles).toContain("chest");
      expect(muscles).not.toContain("legs");
    });

    it("uses the gym's wording for the day title in the requested language", () => {
      expect(generator.planDays(profile, [WED], "es")[0].title).toBe("Tirón: espalda y bíceps");
      expect(generator.planDays(profile, [WED], "en")[0].title).toBe("Pull: back & biceps");
    });

    it("prescribes sets/reps from the goal (muscle gain => 8-10)", () => {
      const [monday] = generator.planDays(profile, [MON], "es");
      const strength = monday.exercises.filter((e) => !byId[e.exerciseId].muscles.includes("core"));
      expect(strength.every((e) => e.reps === "8-10")).toBe(true);
    });

    it("does not repeat exercises across days generated together", () => {
      const plan = generator.planDays(profile, [MON, WED, FRI], "es");
      const all = plan.flatMap((d) => d.exercises.map((e) => e.exerciseId));
      const sharedWithinDay = plan.every(
        (d) => new Set(d.exercises.map((e) => e.exerciseId)).size === d.exercises.length
      );
      expect(sharedWithinDay).toBe(true);
      expect(all.length).toBeGreaterThan(10);
    });
  });

  describe("without history", () => {
    it("falls back to the profile and rotates the split", () => {
      const profile = generator.buildTrainingProfile({ user: baseUser, catalog, sessions: [], now: NOW });
      expect(profile.learned).toBe(false);
      const plan = generator.planDays(profile, [MON, WED, FRI], "es");
      expect(plan.map((d) => d.focus)).toEqual(["PUSH", "PULL", "LEGS"]);
      expect(plan.every((d) => d.basedOn === "ROTATION")).toBe(true);
      expect(plan.every((d) => d.exercises.length >= 3)).toBe(true);
      expect(generator.describeProfile(profile).reason).toBe("NOT_ENOUGH_HISTORY");
    });

    it("adds cardio for a weight-loss goal and lowers sets for beginners", () => {
      const profile = generator.buildTrainingProfile({
        user: { ...baseUser, trainingLevel: "BEGINNER", objectives: ["LOSE_WEIGHT"] },
        catalog,
        sessions: [],
        now: NOW,
      });
      const [day] = generator.planDays(profile, [MON], "es");
      const ids = day.exercises.map((e) => e.exerciseId);
      expect(ids.some((id) => byId[id].muscles.includes("cardio"))).toBe(true);
      const strength = day.exercises.filter((e) => !["cardio", "core"].some((m) => byId[e.exerciseId].muscles.includes(m)));
      expect(strength.every((e) => e.sets <= 3 && e.reps === "12-15")).toBe(true);
    });
  });

  describe("generateRoutines (DB layer)", () => {
    function mockDb({ optedOut = false } = {}) {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.userSettings.findUnique.mockResolvedValue({ machineTrackingOptOut: optedOut });
      prisma.exercise.findMany.mockResolvedValue(catalog);
      prisma.scheduleDay.findMany.mockResolvedValue([]);
      prisma.gymSession.findMany.mockResolvedValue(habitSessions());
      vi.spyOn(behavior, "analyzeUserPatterns").mockResolvedValue(patterns);
      prisma.scheduleDay.upsert.mockImplementation(async ({ create }) => ({ id: `row-${create.date}`, ...create }));
    }

    it("reads history, saves each day as source AI and returns the analysis", async () => {
      mockDb();
      const result = await generator.generateRoutines("user-1", { dates: [WED, MON], language: "es", now: NOW });

      expect(prisma.gymSession.findMany).toHaveBeenCalled();
      expect(prisma.scheduleDay.upsert).toHaveBeenCalledTimes(2);
      expect(prisma.scheduleDay.upsert.mock.calls[0][0].create).toMatchObject({ userId: "user-1", date: MON, source: "AI" });
      expect(result.days.map((d) => d.date)).toEqual([MON, WED]);
      expect(result.days[0].exercises[0].exercise.name).toBeTruthy();
      expect(result.analysis.mode).toBe("LEARNED");
    });

    it("does not save when save=false", async () => {
      mockDb();
      const result = await generator.generateRoutines("user-1", { dates: [MON], save: false, now: NOW });
      expect(prisma.scheduleDay.upsert).not.toHaveBeenCalled();
      expect(result.days).toHaveLength(1);
      expect(result.saved).toBe(false);
    });

    it("does not read machine usage when the member opted out of tracking", async () => {
      mockDb({ optedOut: true });
      const result = await generator.generateRoutines("user-1", { dates: [MON], now: NOW });
      expect(prisma.gymSession.findMany).not.toHaveBeenCalled();
      expect(result.analysis.mode).toBe("PROFILE_ONLY");
      expect(result.analysis.reason).toBe("TRACKING_OPT_OUT");
    });

    it("rejects bad input", async () => {
      await expect(generator.generateRoutines("u", { dates: [] })).rejects.toThrow("non-empty");
      await expect(generator.generateRoutines("u", { dates: ["2026-13-45"] })).rejects.toThrow("YYYY-MM-DD");
    });

    it("fails clearly when the catalog is empty", async () => {
      mockDb();
      prisma.exercise.findMany.mockResolvedValue([]);
      await expect(generator.generateRoutines("u", { dates: [MON], now: NOW })).rejects.toThrow("catalog is empty");
    });
  });
});

describe("learning from the member's past routines", () => {
  const TUE = "2026-10-27";
  const THU = "2026-10-29";
  // Three past Tuesdays with their own chest/triceps routine, three Thursdays of legs.
  const tuesday = (date) => ({
    date,
    exercises: [
      { exerciseId: "benchPress", sets: 5, reps: "5" },
      { exerciseId: "pecDeck", sets: 3, reps: "15" },
      { exerciseId: "cablePushdown", sets: 3, reps: "12" },
    ],
  });
  const thursday = (date) => ({
    date,
    exercises: [
      { exerciseId: "legPress", sets: 4, reps: "12" },
      { exerciseId: "legCurl", sets: 3, reps: "15" },
      { exerciseId: "calfRaise", sets: 4, reps: "20" },
    ],
  });
  const pastRoutines = [
    thursday("2026-10-01"), tuesday("2026-10-06"), thursday("2026-10-08"),
    tuesday("2026-10-13"), thursday("2026-10-15"), tuesday("2026-10-20"),
  ];

  const profile = generator.buildTrainingProfile({ user: baseUser, catalog, sessions: [], pastRoutines, now: NOW });

  it("learns from routines alone, with no gym history", () => {
    expect(profile.learned).toBe(true);
    expect(profile.routinesAnalyzed).toBe(6);
    expect(generator.describeProfile(profile)).toMatchObject({ mode: "LEARNED", reason: null, routinesAnalyzed: 6 });
  });

  it("repeats what they do on each weekday: Tue = push, Thu = legs", () => {
    const plan = generator.planDays(profile, [TUE, THU], "es");
    expect(plan.map((d) => d.focus)).toEqual(["PUSH", "LEGS"]);
    expect(plan.every((d) => d.basedOn === "WEEKDAY_PATTERN")).toBe(true);
  });

  it("brings back their own exercises for that weekday, with their own sets x reps", () => {
    const [tue, thu] = generator.planDays(profile, [TUE, THU], "es");
    const bench = tue.exercises.find((e) => e.exerciseId === "benchPress");
    expect(bench).toEqual({ exerciseId: "benchPress", sets: 5, reps: "5" });
    expect(tue.exercises.map((e) => e.exerciseId)).toEqual(expect.arrayContaining(["pecDeck", "cablePushdown"]));
    expect(thu.exercises.find((e) => e.exerciseId === "legPress")).toEqual({ exerciseId: "legPress", sets: 4, reps: "12" });
  });

  it("estimates days per week and session length from their routines", () => {
    // 6 routines over 3 weeks -> 2 days a week; 10 sets * 3 min = 30 min sessions.
    expect(profile.daysPerWeek).toBe(2);
    expect(profile.sessionMinutes).toBeGreaterThanOrEqual(30);
  });

  it("ignores routines whose exercises no longer exist", () => {
    const p = generator.buildTrainingProfile({
      user: baseUser, catalog, sessions: [], now: NOW,
      pastRoutines: [{ date: "2026-10-06", exercises: [{ exerciseId: "deleted", sets: 3, reps: "10" }] }],
    });
    expect(p.routinesAnalyzed).toBe(0);
    expect(p.learned).toBe(false);
  });

  describe("DB layer", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.exercise.findMany.mockResolvedValue(catalog);
      prisma.gymSession.findMany.mockResolvedValue([]);
      vi.spyOn(behavior, "analyzeUserPatterns").mockResolvedValue(null);
      prisma.scheduleDay.upsert.mockImplementation(async ({ create }) => ({ id: `row-${create.date}`, ...create }));
    });

    it("reads the member's saved days and still uses them when machine tracking is off", async () => {
      prisma.userSettings.findUnique.mockResolvedValue({ machineTrackingOptOut: true });
      prisma.scheduleDay.findMany.mockResolvedValue(pastRoutines);

      const result = await generator.generateRoutines("user-1", { dates: [TUE], now: NOW });

      expect(prisma.scheduleDay.findMany.mock.calls[0][0].where.userId).toBe("user-1");
      expect(prisma.gymSession.findMany).not.toHaveBeenCalled();
      expect(result.analysis).toMatchObject({ mode: "LEARNED", routinesAnalyzed: 6 });
      expect(result.days[0].focus).toBe("PUSH");
    });

    it("doesn't learn from the day being regenerated", async () => {
      prisma.userSettings.findUnique.mockResolvedValue(null);
      prisma.scheduleDay.findMany.mockResolvedValue([tuesday("2026-10-20"), tuesday("2026-10-13"), tuesday(TUE)]);

      const result = await generator.generateRoutines("user-1", { dates: [TUE], now: NOW });
      // only 2 past Tuesdays remain (< 3 needed to learn)
      expect(result.analysis.routinesAnalyzed).toBe(2);
      expect(result.analysis.mode).toBe("PROFILE_ONLY");
    });
  });
});
