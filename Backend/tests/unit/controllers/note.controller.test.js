import { describe, it, expect, beforeEach, vi } from "vitest";
import * as noteController from "../../../src/controllers/note.controller.js";
import * as noteService from "../../../src/services/note.service.js";

vi.mock("../../../src/services/note.service.js");

describe("NoteController", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: { id: "trainer-1", role: "TRAINER" },
      params: {},
      validatedData: {},
    };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it("getNotes fetches notes for the target user scoped by caller id and role", async () => {
    req.params.id = "user-1";
    const notes = [{ id: "note-1", note: "Good progress" }];
    noteService.getNotes.mockResolvedValue(notes);

    await noteController.getNotes(req, res, next);

    expect(noteService.getNotes).toHaveBeenCalledWith("user-1", "trainer-1", "TRAINER");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: notes });
  });

  it("createNote creates a note for the target user with the given visibility", async () => {
    req.params.id = "user-1";
    req.validatedData = { note: "Great session", visibility: "TRAINERS_ONLY" };
    const created = { id: "note-1", note: "Great session" };
    noteService.createNote.mockResolvedValue(created);

    await noteController.createNote(req, res, next);

    expect(noteService.createNote).toHaveBeenCalledWith(
      "trainer-1",
      "user-1",
      "Great session",
      "TRAINERS_ONLY"
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: created });
  });

  it("updateNote updates the note authored by the caller", async () => {
    req.params.noteId = "note-1";
    req.validatedData = { note: "Updated text" };
    const updated = { id: "note-1", note: "Updated text" };
    noteService.updateNote.mockResolvedValue(updated);

    await noteController.updateNote(req, res, next);

    expect(noteService.updateNote).toHaveBeenCalledWith("note-1", "trainer-1", "Updated text");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: updated });
  });

  it("deleteNote deletes the note and returns success", async () => {
    req.params.noteId = "note-1";
    noteService.deleteNote.mockResolvedValue(undefined);

    await noteController.deleteNote(req, res, next);

    expect(noteService.deleteNote).toHaveBeenCalledWith("note-1", "trainer-1");
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it("forwards service errors to next() instead of throwing", async () => {
    req.params.id = "user-1";
    const error = new Error("boom");
    noteService.getNotes.mockRejectedValue(error);

    await noteController.getNotes(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
