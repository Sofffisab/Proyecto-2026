import { describe, it, expect, beforeEach, vi } from 'vitest';
import { noteService } from '../../../src/services/note.service.js';
import { prisma } from '../../../src/config/prisma.js';
import { AppError } from '../../../src/utils/errors.js';


describe('NoteService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a trainer note about a user', async () => {
    const mockNote = {
      id: 'note-1',
      trainerId: 'trainer-1',
      userId: 'user-1',
      content: 'Test note',
      createdAt: new Date(),
    };

    prisma.note.create.mockResolvedValue(mockNote);

    const result = await noteService.create('trainer-1', 'user-1', 'Test note');

    expect(result.trainerId).toBe('trainer-1');
    expect(result.userId).toBe('user-1');
    expect(prisma.note.create).toHaveBeenCalled();
  });

  it('only allows the authoring trainer or an admin to edit/delete', async () => {
    const mockNote = {
      id: 'note-1',
      trainerId: 'trainer-1',
      userId: 'user-1',
    };

    prisma.note.findUnique.mockResolvedValue(mockNote);

    // Trainer diferente intenta editar
    await expect(
      noteService.update('note-1', 'trainer-2', 'New content')
    ).rejects.toThrow();

    // The correct trainer can edit
    prisma.note.update.mockResolvedValue({
      ...mockNote,
      content: 'New content',
    });

    const result = await noteService.update('note-1', 'trainer-1', 'New content');
    expect(result).toBeDefined();
  });

  it('getNotes returns notes for a specific user', async () => {
    const mockNotes = [
      { id: 'note-1', userId: 'user-1', trainerId: 'trainer-1' },
      { id: 'note-2', userId: 'user-1', trainerId: 'trainer-2' },
    ];

    prisma.note.findMany.mockResolvedValue(mockNotes);

    const result = await noteService.getNotes('user-1');

    expect(prisma.note.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
      })
    );
    expect(result).toHaveLength(2);
  });
});
