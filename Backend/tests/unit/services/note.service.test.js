import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as noteService from '../../../src/services/note.service.js';
import { prisma } from '../../../src/config/prisma.js';

describe('NoteService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a trainer note about a user', async () => {
    const mockNote = {
      id: 'note-1',
      trainerId: 'trainer-1',
      userId: 'user-1',
      note: 'Test note',
      visibility: 'PRIVATE',
      createdAt: new Date(),
    };

    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.trainerNote.create.mockResolvedValue(mockNote);

    const result = await noteService.createNote('trainer-1', 'user-1', 'Test note');

    expect(result.trainerId).toBe('trainer-1');
  });

  it('only allows the authoring trainer or an admin to edit/delete', async () => {
    prisma.trainerNote.findUnique.mockResolvedValue({
      id: 'note-1',
      trainerId: 'trainer-1',
      userId: 'user-1',
    });

    await expect(
      noteService.updateNote('note-1', 'trainer-2', 'New content')
    ).rejects.toThrow();
  });

  it('getNotes returns notes for a specific user', async () => {
    const mockNotes = [{ id: 'note-1', userId: 'user-1' }];
    prisma.trainerNote.findMany.mockResolvedValue(mockNotes);

    const result = await noteService.getNotes('user-1', 'admin-1', 'ADMIN');

    expect(prisma.trainerNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } })
    );
    expect(result).toEqual(mockNotes);
  });

  it('getNotes restricts a TRAINER caller to their own notes plus PUBLIC ones', async () => {
    const mockNotes = [{ id: 'note-1', userId: 'user-1' }];
    prisma.trainerNote.findMany.mockResolvedValue(mockNotes);

    await noteService.getNotes('user-1', 'trainer-1', 'TRAINER');

    expect(prisma.trainerNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-1',
          OR: [{ trainerId: 'trainer-1' }, { visibility: 'PUBLIC' }],
        },
      })
    );
  });

  it('createNote throws if the target user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      noteService.createNote('trainer-1', 'ghost-user', 'Test note')
    ).rejects.toThrow('User not found');

    expect(prisma.trainerNote.create).not.toHaveBeenCalled();
  });

  it('createNote keeps PUBLIC visibility when explicitly requested', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.trainerNote.create.mockResolvedValue({ id: 'note-1' });

    await noteService.createNote('trainer-1', 'user-1', 'Test note', 'PUBLIC');

    expect(prisma.trainerNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ visibility: 'PUBLIC' }),
      })
    );
  });

  it('createNote coerces any non-PUBLIC visibility value to PRIVATE', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.trainerNote.create.mockResolvedValue({ id: 'note-1' });

    await noteService.createNote('trainer-1', 'user-1', 'Test note', 'SOMETHING_ELSE');

    expect(prisma.trainerNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ visibility: 'PRIVATE' }),
      })
    );
  });

  it('updateNote throws if the note does not exist', async () => {
    prisma.trainerNote.findUnique.mockResolvedValue(null);

    await expect(
      noteService.updateNote('missing-note', 'trainer-1', 'New content')
    ).rejects.toThrow('Note not found');

    expect(prisma.trainerNote.update).not.toHaveBeenCalled();
  });

  it('updateNote succeeds when the caller is the authoring trainer', async () => {
    prisma.trainerNote.findUnique.mockResolvedValue({
      id: 'note-1',
      trainerId: 'trainer-1',
      userId: 'user-1',
    });
    prisma.trainerNote.update.mockResolvedValue({ id: 'note-1', note: 'New content' });

    const result = await noteService.updateNote('note-1', 'trainer-1', 'New content');

    expect(prisma.trainerNote.update).toHaveBeenCalledWith({
      where: { id: 'note-1' },
      data: { note: 'New content' },
    });
    expect(result.note).toBe('New content');
  });

  it('deleteNote throws if the note does not exist', async () => {
    prisma.trainerNote.findUnique.mockResolvedValue(null);

    await expect(
      noteService.deleteNote('missing-note', 'trainer-1')
    ).rejects.toThrow('Note not found');

    expect(prisma.trainerNote.delete).not.toHaveBeenCalled();
  });

  it('deleteNote throws Forbidden if a different trainer wrote the note', async () => {
    prisma.trainerNote.findUnique.mockResolvedValue({
      id: 'note-1',
      trainerId: 'trainer-1',
      userId: 'user-1',
    });

    await expect(
      noteService.deleteNote('note-1', 'trainer-2')
    ).rejects.toThrow('Forbidden');

    expect(prisma.trainerNote.delete).not.toHaveBeenCalled();
  });

  it('deleteNote succeeds when the caller is the authoring trainer', async () => {
    prisma.trainerNote.findUnique.mockResolvedValue({
      id: 'note-1',
      trainerId: 'trainer-1',
      userId: 'user-1',
    });
    prisma.trainerNote.delete.mockResolvedValue({ id: 'note-1' });

    const result = await noteService.deleteNote('note-1', 'trainer-1');

    expect(prisma.trainerNote.delete).toHaveBeenCalledWith({ where: { id: 'note-1' } });
    expect(result).toEqual({ id: 'note-1' });
  });
});
