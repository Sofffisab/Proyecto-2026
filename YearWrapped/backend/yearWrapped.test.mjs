// Test sin base de datos:  node YearWrapped/backend/yearWrapped.test.mjs
import assert from "node:assert/strict";
import { buildYearWrapped } from "./yearWrapped.service.js";

const U = "me";
// OJO: 2026-03-14T01:30Z en Argentina (UTC-3) es el 13/03 22:30 -> cuenta como 13/03.
const raw = {
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
};

const out = buildYearWrapped(raw, { year: 2026, userId: U });
assert.equal(out.totalPoints, 150);
assert.equal(out.friendsMade, 2);
assert.equal(out.achievementsUnlocked, 4);
assert.equal(out.gymDays, 3); // 13/03, 15/03, 02/05
assert.equal(out.machinesUsed, 2);
assert.equal(out.topMachine.name, "Prensa");
assert.equal(out.mostIntenseDay.date, "2026-03-13");
assert.equal(out.mostIntenseDay.minutes, 120);
assert.equal(out.distinctRoutines, 3); // pecho y tríceps, gr1, piernas
assert.equal(out.goalsCompleted.count, 2);
assert.equal(out.goalsCompleted.items[0].difficulty, "HARD");
assert.equal(out.goalsCompleted.items[0].label, "Fuerza · Subir 100 kg");
assert.equal(out.gift.percent, 50);
console.log("OK", JSON.stringify(out, null, 1).slice(0, 400));
