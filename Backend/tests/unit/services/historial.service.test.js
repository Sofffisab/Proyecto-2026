import { describe, it, expect, vi, beforeEach } from "vitest";
import * as historial from "../../../src/services/historial.service.js";
import prisma from "../../../src/config/prisma.js";

describe("HistorialService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("registrarEvento", () => {
    it("stores one row with the given data", async () => {
      prisma.historialEvento.create.mockResolvedValue({ id: "h1" });
      const at = new Date("2026-11-01T10:00:00Z");

      await historial.registrarEvento({ userId: "u1", tipo: "GYM_CHECK_IN", gymSessionId: "s1", occurredAt: at });

      expect(prisma.historialEvento.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: "u1", tipo: "GYM_CHECK_IN", gymSessionId: "s1", occurredAt: at }),
      });
    });

    it("never throws: a DB failure must not break the real action", async () => {
      prisma.historialEvento.create.mockRejectedValue(new Error("db down"));
      await expect(historial.registrarEvento({ userId: "u1", tipo: "GYM_CHECK_OUT" })).resolves.toBeNull();
    });

    it("ignores unknown types and missing users", async () => {
      expect(await historial.registrarEvento({ userId: "u1", tipo: "NOPE" })).toBeNull();
      expect(await historial.registrarEvento({ tipo: "GYM_CHECK_IN" })).toBeNull();
      expect(prisma.historialEvento.create).not.toHaveBeenCalled();
    });
  });

  describe("registrarUsoMaquina", () => {
    it("snapshots the machine name", async () => {
      prisma.machine.findUnique.mockResolvedValue({ name: "Prensa", zone: "Zona de piernas" });
      prisma.historialEvento.create.mockResolvedValue({ id: "h2" });

      await historial.registrarUsoMaquina({ userId: "u1", machineId: "m1", gymSessionId: "s1" });

      expect(prisma.historialEvento.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tipo: "MACHINE_USE",
          machineId: "m1",
          metadata: { machineName: "Prensa", zone: "Zona de piernas" },
        }),
      });
    });
  });

  describe("getHistorial", () => {
    const row = (id, iso, extra = {}) => ({
      id,
      tipo: "GYM_CHECK_IN",
      occurredAt: new Date(iso),
      otherUserId: null,
      otherUser: null,
      machineId: null,
      gymSessionId: null,
      metadata: null,
      ...extra,
    });

    it("returns newest-first items with the other person's name and a cursor when there is more", async () => {
      prisma.historialEvento.findMany.mockResolvedValue([
        row("a", "2026-11-01T12:00:00Z", {
          tipo: "TRAINER_ASSISTANCE",
          otherUserId: "t1",
          otherUser: { id: "t1", firstName: "Ana", lastName: "Gómez" },
        }),
        row("b", "2026-11-01T11:00:00Z"),
        row("c", "2026-11-01T10:00:00Z"), // the extra row => there is a next page
      ]);

      const res = await historial.getHistorial("u1", { limit: 2 });

      expect(prisma.historialEvento.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "u1" }, take: 3 })
      );
      expect(res.items.map((i) => i.id)).toEqual(["a", "b"]);
      expect(res.items[0].otherUserName).toBe("Ana Gómez");
      expect(res.nextCursor).toBe("2026-11-01T11:00:00.000Z");
    });

    it("has no cursor on the last page, and applies before/tipo filters", async () => {
      prisma.historialEvento.findMany.mockResolvedValue([row("a", "2026-11-01T12:00:00Z")]);

      const res = await historial.getHistorial("u1", { before: "2026-11-02T00:00:00Z", tipo: "GYM_CHECK_IN" });

      expect(res.nextCursor).toBeNull();
      expect(prisma.historialEvento.findMany.mock.calls[0][0].where).toEqual({
        userId: "u1",
        occurredAt: { lt: new Date("2026-11-02T00:00:00Z") },
        tipo: "GYM_CHECK_IN",
      });
    });
  });
});
