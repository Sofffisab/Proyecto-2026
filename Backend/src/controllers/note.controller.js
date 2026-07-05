import * as noteService from "../services/note.service.js";

export async function getNotes(req, res, next) {
  try {
    const data = await noteService.getNotes(
      req.params.id,
      req.user.id,
      req.user.role
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createNote(req, res, next) {
  try {
    const data = await noteService.createNote(
      req.user.id,
      req.params.id,
      req.validatedData.note,
      req.validatedData.visibility
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateNote(req, res, next) {
  try {
    const data = await noteService.updateNote(
      req.params.noteId,
      req.user.id,
      req.validatedData.note
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function deleteNote(req, res, next) {
  try {
    await noteService.deleteNote(req.params.noteId, req.user.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}