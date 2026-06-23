import prisma from "../config/prisma.js";

export async function getNotes(targetUserId, callerId, callerRole) {
  const where = { userId: targetUserId };

  // Trainers see only their own notes; admins see all notes for the user
  if (callerRole === "TRAINER") {
    where.trainerId = callerId;
  }

  return prisma.trainerNote.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      trainer: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function createNote(trainerId, targetUserId, note) {
  // Bug 32: verify the target user exists before creating a note.
  // Prevents notes from being created for arbitrary/non-existent UUIDs.
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw new Error("User not found");

  return prisma.trainerNote.create({
    data: { trainerId, userId: targetUserId, note },
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