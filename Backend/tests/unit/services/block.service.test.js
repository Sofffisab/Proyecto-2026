import { describe, it, expect, vi, beforeEach } from "vitest";
import * as blockService from "../../../src/services/block.service.js";
import prisma from "../../../src/config/prisma.js";

describe("BlockService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("name matching", () => {
    it("ignores case, accents and word order", () => {
      expect(blockService.normalizeName("  JOSÉ   Pérez ")).toBe("jose perez");
      expect(blockService.sameFullName("jose perez", "José", "Pérez")).toBe(true);
      expect(blockService.sameFullName("Pérez, José".replace(",", ""), "José", "Pérez")).toBe(true);
    });

    it("does not match a partial name", () => {
      expect(blockService.sameFullName("jose", "José", "Pérez")).toBe(false);
      expect(blockService.sameFullName("", "José", "Pérez")).toBe(false);
    });
  });

  describe("blockByName", () => {
    it("blocks the one person that matches", async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: "u2", firstName: "José", lastName: "Pérez" },
        { id: "u3", firstName: "José", lastName: "Pérez Gómez" },
      ]);
      prisma.userBlock.findUnique.mockResolvedValue(null);
      prisma.userBlock.create.mockResolvedValue({ id: "b1", blockedId: "u2", createdAt: new Date() });

      const res = await blockService.blockByName("u1", "jose perez");

      expect(prisma.userBlock.create).toHaveBeenCalledWith({ data: { blockerId: "u1", blockedId: "u2" } });
      expect(res).toMatchObject({ blockedId: "u2", name: "José Pérez", alreadyBlocked: false });
    });

    it("is idempotent when the person is already blocked", async () => {
      prisma.user.findMany.mockResolvedValue([{ id: "u2", firstName: "Ana", lastName: "Gómez" }]);
      prisma.userBlock.findUnique.mockResolvedValue({ id: "b1", blockedId: "u2", createdAt: new Date() });

      const res = await blockService.blockByName("u1", "Ana Gómez");

      expect(prisma.userBlock.create).not.toHaveBeenCalled();
      expect(res.alreadyBlocked).toBe(true);
    });

    it("404 when nobody has that name", async () => {
      prisma.user.findMany.mockResolvedValue([]);
      await expect(blockService.blockByName("u1", "Nadie Existe")).rejects.toMatchObject({ statusCode: 404 });
    });

    it("409 when several people share the name (never guesses)", async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: "u2", firstName: "Ana", lastName: "Gómez" },
        { id: "u3", firstName: "Ana", lastName: "Gomez" },
      ]);
      await expect(blockService.blockByName("u1", "Ana Gomez")).rejects.toMatchObject({ statusCode: 409 });
      expect(prisma.userBlock.create).not.toHaveBeenCalled();
    });

    it("refuses to block yourself", async () => {
      prisma.user.findMany.mockResolvedValue([{ id: "u1", firstName: "Yo", lastName: "Mismo" }]);
      await expect(blockService.blockByName("u1", "Yo Mismo")).rejects.toMatchObject({ statusCode: 400 });
    });

    it("422 on an empty name", async () => {
      await expect(blockService.blockByName("u1", "   ")).rejects.toMatchObject({ statusCode: 422 });
    });
  });

  it("unblock reports how many rows were removed", async () => {
    prisma.userBlock.deleteMany.mockResolvedValue({ count: 1 });
    expect(await blockService.unblock("u1", "u2")).toEqual({ removed: 1 });
  });
});
