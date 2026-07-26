import { prisma } from "../config/index.js";

export async function getNotes(targetUserId, callerId, callerRole) {
  const where = { userId: targetUserId };

  // Admins see every note. A trainer sees their own notes (public or
  // private) plus any PUBLIC note another trainer left on this user —
  // PRIVATE notes stay visible only to the trainer who wrote them.
  if (callerRole === "TRAINER") {
    where.OR = [{ trainerId: callerId }, { visibility: "PUBLIC" }];
  }

  return prisma.trainerNote.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      trainer: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function createNote(trainerId, targetUserId, note, visibility = "PRIVATE") {
  // Verify the target user exists before creating a note.
  // Prevents notes from being created for arbitrary/non-existent UUIDs.
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw new Error("User not found");

  return prisma.trainerNote.create({
    data: { trainerId, userId: targetUserId, note, visibility: visibility === "PUBLIC" ? "PUBLIC" : "PRIVATE" },
  });
}

export async function updateNote(noteId, trainerId, note) {
  const existing = await prisma.trainerNote.findUnique({ where: { id: noteId } });
  if (!existing) throw new Error("Note not found");
  if (existing.trainerId !== trainerId) throw new Error("Forbidden");

  return prisma.trainerNote.update({
    where: { id: noteId },
    data: { note },
  });
}

export async function deleteNote(noteId, trainerId) {
  const existing = await prisma.trainerNote.findUnique({ where: { id: noteId } });
  if (!existing) throw new Error("Note not found");
  if (existing.trainerId !== trainerId) throw new Error("Forbidden");

  return prisma.trainerNote.delete({ where: { id: noteId } });
}

