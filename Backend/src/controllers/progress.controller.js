import * as progressService from "../services/progress.service.js";
import prisma from "../config/prisma.js";

export async function createProgress(req, res, next) {
  try {
    const data = await progressService.addProgress(
      req.user.id,
      req.body.goalId,
      req.body.value
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getProgress(req, res, next) {
  try {
    const data = await progressService.getProgressHistory(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getProgressById(req, res, next) {
  try {
    const entry = await prisma.progressEntry.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!entry) {
      return res.status(404).json({ success: false, message: "Progress entry not found" });
    }
    res.json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
}

export async function updateProgress(req, res, next) {
  try {
    const entry = await prisma.progressEntry.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!entry) {
      return res.status(404).json({ success: false, message: "Progress entry not found" });
    }
    const updated = await prisma.progressEntry.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function deleteProgress(req, res, next) {
  try {
    const entry = await prisma.progressEntry.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!entry) {
      return res.status(404).json({ success: false, message: "Progress entry not found" });
    }
    await prisma.progressEntry.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
}

export async function getProgressStats(req, res, next) {
  try {
    const data = await progressService.getProgressStats(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}