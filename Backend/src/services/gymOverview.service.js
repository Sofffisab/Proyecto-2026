// What the trainer sees of the gym right now: the "Gym" tab numbers, the list
// of people inside (with who pressed "Pedir ayuda") and one person's data when
// the trainer goes to help them.

import { prisma } from "../config/index.js";
import { AppError } from "../utils/errors.js";
import { normalizeMedical } from "./routine.service.js";

const nameOf = (u) => `${u?.firstName ?? ""} ${u?.lastName ?? ""}`.trim() || u?.email || null;

/** Open gym sessions of regular members (staff inside the gym are not "people to help"). */
async function openMemberSessions(extraSelect = {}) {
  return prisma.gymSession.findMany({
    where: { checkOutAt: null, user: { role: "USER", isActive: true } },
    orderBy: { checkInAt: "asc" },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          profilePhoto: true,
          settings: { select: { disableAssistance: true, machineTrackingOptOut: true } },
          ...extraSelect,
        },
      },
    },
  });
}

/** Help requests that still matter: pending and from somebody who is still in the gym. */
function pendingRequestsOf(sessions, pending) {
  const inside = new Set(sessions.map((s) => s.userId));
  const byUser = new Map();
  (pending ?? []).forEach((a) => {
    if (inside.has(a.userId) && !byUser.has(a.userId)) byUser.set(a.userId, a); // oldest first
  });
  return byUser;
}

export async function getTrainerSummary(trainerId) {
  const [sessions, pending, machinesInUse, machinesTotal, profile] = await Promise.all([
    openMemberSessions(),
    prisma.assistance.findMany({ where: { status: "PENDING" }, orderBy: { requestedAt: "asc" } }),
    prisma.machineUsage.findMany({ where: { endedAt: null }, select: { machineId: true }, distinct: ["machineId"] }),
    prisma.machine.count({ where: { active: true } }),
    prisma.trainerProfile.findUnique({ where: { userId: trainerId }, select: { availability: true } }),
  ]);

  return {
    peopleInGym: (sessions ?? []).length,
    machinesInUse: (machinesInUse ?? []).length,
    machinesTotal: machinesTotal ?? 0,
    helpRequests: pendingRequestsOf(sessions ?? [], pending).size,
    availability: profile?.availability ?? "AVAILABLE",
  };
}

/** People inside the gym, the ones asking for help first (longest wait first). */
export async function getPeopleInGym(trainerId) {
  const sessions = (await openMemberSessions()) ?? [];
  const userIds = sessions.map((s) => s.userId);

  const [pending, usages, assisted] = await Promise.all([
    prisma.assistance.findMany({ where: { status: "PENDING", userId: { in: userIds } }, orderBy: { requestedAt: "asc" } }),
    prisma.machineUsage.findMany({
      where: { userId: { in: userIds }, endedAt: null },
      orderBy: { startedAt: "desc" },
      include: { machine: { select: { name: true, zone: true } } },
    }),
    prisma.assistance.findMany({
      where: { trainerId, status: "COMPLETED", userId: { in: userIds } },
      select: { userId: true, completedAt: true },
    }),
  ]);

  const requests = pendingRequestsOf(sessions, pending);
  const usageByUser = new Map();
  (usages ?? []).forEach((u) => {
    if (!usageByUser.has(u.userId)) usageByUser.set(u.userId, u);
  });

  const people = sessions
    .filter((s) => requests.has(s.userId) || !s.user.settings?.disableAssistance)
    .map((s) => {
      const request = requests.get(s.userId);
      const usage = s.user.settings?.machineTrackingOptOut ? null : usageByUser.get(s.userId);
      return {
        id: s.userId,
        name: nameOf(s.user),
        photo: s.user.profilePhoto ?? null,
        checkInAt: s.checkInAt,
        needsHelp: Boolean(request),
        helpRequestedAt: request?.requestedAt ?? null,
        pendingAssistanceId: request?.id ?? null,
        location: usage?.machine ? (usage.machine.zone ? `${usage.machine.zone} · ${usage.machine.name}` : usage.machine.name) : null,
        // Already helped by this trainer during the current visit.
        helpedByMe: (assisted ?? []).some((a) => a.userId === s.userId && a.completedAt && new Date(a.completedAt) >= new Date(s.checkInAt)),
      };
    });

  people.sort((a, b) => {
    if (a.needsHelp !== b.needsHelp) return a.needsHelp ? -1 : 1;
    if (a.needsHelp) return new Date(a.helpRequestedAt) - new Date(b.helpRequestedAt);
    return String(a.name).localeCompare(String(b.name), "es");
  });
  return people;
}

/** What a trainer needs to know about one person inside the gym before helping them. */
export async function getPersonInGym(trainerId, userId) {
  const session = await prisma.gymSession.findFirst({ where: { userId, checkOutAt: null } });
  if (!session) throw new AppError("This person is not in the gym right now", 404);

  const [user, pending, mine, notes] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, medicalConditions: true, objectives: true, trainingLevel: true },
    }),
    prisma.assistance.findFirst({ where: { userId, status: { in: ["PENDING", "ASSIGNED"] } }, orderBy: { requestedAt: "asc" } }),
    prisma.assistance.findFirst({ where: { userId, trainerId, status: "ASSIGNED" } }),
    // Own notes (public or private) + public notes of other trainers; never someone else's private ones.
    prisma.trainerNote.findMany({
      where: { userId, OR: [{ trainerId }, { visibility: "PUBLIC" }] },
      orderBy: { createdAt: "desc" },
      include: { trainer: { select: { id: true, firstName: true, lastName: true } } },
    }),
  ]);

  if (!user || user.role !== "USER") throw new AppError("This person is not in the gym right now", 404);

  return {
    id: user.id,
    name: nameOf(user),
    medical: normalizeMedical(user.medicalConditions),
    objectives: user.objectives ?? [],
    level: user.trainingLevel ?? null,
    needsHelp: pending?.status === "PENDING",
    pendingAssistanceId: pending?.status === "PENDING" ? pending.id : null,
    // A help this trainer already started and has not finished.
    activeAssistanceId: mine?.id ?? null,
    takenByOther: pending?.status === "ASSIGNED" && !mine,
    notes: (notes ?? []).map((n) => ({
      id: n.id,
      note: n.note,
      visibility: n.visibility,
      mine: n.trainerId === trainerId,
      author: nameOf(n.trainer),
      createdAt: n.createdAt,
    })),
  };
}
