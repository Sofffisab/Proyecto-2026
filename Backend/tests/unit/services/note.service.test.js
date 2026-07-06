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
});
