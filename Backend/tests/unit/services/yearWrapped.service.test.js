import { describe, it, expect } from "vitest";
import { buildYearWrapped } from "../../../src/services/yearWrapped.service.js";

const U = "me";

// 2026-03-14T01:30Z en Argentina (UTC-3) es el 13/03 22:30 -> cuenta como 13/03.
const baseRaw = () => ({
  user: { firstName: "Sofi" },
  sessions: [
    { id: "s1", checkInAt: new Date("2026-03-14T01:30:00Z"), durationMinutes: 120 },
    { id: "s2", checkInAt: new Date("2026-03-15T15:00:00Z"), durationMinutes: 60 },
    { id: "s3", checkInAt: new Date("2026-03-15T22:00:00Z"), durationMinutes: 15 }, // mismo día que s2
    { id: "s4", checkInAt: new Date("2026-05-02T12:00:00Z"), durationMinutes: 45 },
  ],
  machineUsages: [
    { machineId: "m1", startedAt: new Date("2026-03-14T01:40:00Z"), machine: { name: "Prensa" } },
    { machineId: "m2", startedAt: new Date("2026-03-14T01:50:00Z"), machine: { name: "Remo" } },
    { machineId: "m1", startedAt: new Date("2026-05-02T12:10:00Z"), machine: { name: "Prensa" } },
  ],
  pointRows: [
    { points: 100, createdAt: new Date("2026-03-14T02:00:00Z") },
    { points: 50, createdAt: new Date("2026-05-02T13:00:00Z") },
    { points: -30, createdAt: new Date("2026-06-01T13:00:00Z") }, // canje: no resta
  ],
  friendChallenges: [
    { userId: U, partnerUserId: "a" },
    { userId: "b", partnerUserId: U },
    { userId: U, partnerUserId: "a" }, // repetido: 1 sola persona
  ],
  unlockedAchievements: 4,
  goals: [
    { id: "g1", type: "WEIGHT", action: "LOSE", targetValue: 5, unit: "kg", difficulty: "EASY", completedAt: new Date("2026-04-01") },
    { id: "g2", type: "STRENGTH", action: "GAIN", targetValue: 100, unit: "kg", difficulty: "HARD", completedAt: new Date("2026-02-01") },
  ],
  scheduleDays: [
    { id: "d1", title: "Pecho y tríceps", generalRoutineId: null },
    { id: "d2", title: "pecho y tríceps ", generalRoutineId: null },
    { id: "d3", title: "", generalRoutineId: "gr1" },
    { id: "d4", title: "", generalRoutineId: null },
  ],
  createdRoutines: [{ id: "r1", name: "Piernas" }],
  totalMachines: 20,
});

describe("yearWrapped.service#buildYearWrapped", () => {
  const out = buildYearWrapped(baseRaw(), { year: 2026, userId: U });

  it("suma solo los puntos positivos", () => {
    expect(out.totalPoints).toBe(150);
  });

  it("cuenta personas distintas como amigos", () => {
    expect(out.friendsMade).toBe(2);
  });

  it("cuenta días distintos de gym según la zona horaria (UTC-3)", () => {
    expect(out.gymDays).toBe(3);
  });

  it("cuenta máquinas distintas y detecta la favorita", () => {
    expect(out.machinesUsed).toBe(2);
    expect(out.topMachine).toEqual({ name: "Prensa", count: 2 });
  });

  it("elige el día más intenso", () => {
    expect(out.mostIntenseDay).toMatchObject({ date: "2026-03-13", minutes: 120, machines: 2 });
  });

  it("cuenta rutinas distintas sin repetir", () => {
    expect(out.distinctRoutines).toBe(3);
  });

  it("ordena las metas por dificultad y arma la etiqueta", () => {
    expect(out.goalsCompleted.count).toBe(2);
    expect(out.goalsCompleted.items[0]).toMatchObject({ difficulty: "HARD", label: "Fuerza · Subir 100 kg" });
  });

  it("incluye el regalo del 50% en la cuota de enero", () => {
    expect(out.gift).toEqual({ percent: 50, concept: "cuota de enero", validUntil: "2027-01-31" });
  });

  it("no rompe con un usuario sin actividad", () => {
    const empty = buildYearWrapped(
      { user: null, sessions: [], machineUsages: [], pointRows: [], friendChallenges: [], unlockedAchievements: 0, goals: [], scheduleDays: [], createdRoutines: [], totalMachines: 0 },
      { year: 2026, userId: U }
    );
    expect(empty).toMatchObject({ totalPoints: 0, friendsMade: 0, gymDays: 0, machinesUsed: 0, mostIntenseDay: null, distinctRoutines: 0 });
    expect(empty.goalsCompleted).toEqual({ count: 0, items: [] });
  });
});
