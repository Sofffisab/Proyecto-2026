import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendBirthdayGreetings } from "../../../src/jobs/birthday.job.js";
import prisma from "../../../src/config/prisma.js";
import { sendBirthdayEmail } from "../../../src/services/communication.service.js";

vi.mock("../../../src/config/prisma.js", () => ({
  default: {
    user: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../../../src/services/communication.service.js", () => ({
  sendBirthdayEmail: vi.fn(),
}));

// Freeze "today" to July 7th so birthday matching is deterministic.
const TODAY = new Date("2026-07-07T08:00:00Z");

describe("sendBirthdayGreetings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.update.mockResolvedValue({});
    sendBirthdayEmail.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does nothing when no active user has a birthday today", async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: "u1", email: "a@x.com", firstName: "Ana", birthday: new Date("1990-01-01"), lastBirthdayEmailAt: null },
    ]);

    await sendBirthdayGreetings();

    expect(sendBirthdayEmail).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("greets and stamps users whose birthday is today", async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: "u1", email: "a@x.com", firstName: "Ana", birthday: new Date("1990-07-07"), lastBirthdayEmailAt: null },
    ]);

    await sendBirthdayGreetings();

    expect(sendBirthdayEmail).toHaveBeenCalledWith("a@x.com", "Ana", "u1");
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { lastBirthdayEmailAt: TODAY },
    });
  });

  it("does not re-greet a user already congratulated this year", async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: "u1",
        email: "a@x.com",
        firstName: "Ana",
        birthday: new Date("1990-07-07"),
        lastBirthdayEmailAt: new Date("2026-07-07T00:00:00Z"),
      },
    ]);

    await sendBirthdayGreetings();

    expect(sendBirthdayEmail).not.toHaveBeenCalled();
  });

  it("greets again if the last email was from a previous year", async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: "u1",
        email: "a@x.com",
        firstName: "Ana",
        birthday: new Date("1990-07-07"),
        lastBirthdayEmailAt: new Date("2025-07-07T00:00:00Z"),
      },
    ]);

    await sendBirthdayGreetings();

    expect(sendBirthdayEmail).toHaveBeenCalledTimes(1);
  });

  it("keeps greeting remaining users if one fails", async () => {
    sendBirthdayEmail
      .mockRejectedValueOnce(new Error("resend down"))
      .mockResolvedValueOnce({});

    prisma.user.findMany.mockResolvedValue([
      { id: "u1", email: "a@x.com", firstName: "Ana", birthday: new Date("1990-07-07"), lastBirthdayEmailAt: null },
      { id: "u2", email: "b@x.com", firstName: "Bob", birthday: new Date("1985-07-07"), lastBirthdayEmailAt: null },
    ]);

    await sendBirthdayGreetings();

    expect(sendBirthdayEmail).toHaveBeenCalledTimes(2);
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u2" },
      data: { lastBirthdayEmailAt: TODAY },
    });
  });
});
