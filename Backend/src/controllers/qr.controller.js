import * as verificationService from "../services/verification.service.js";
import { prisma } from "../config/index.js";
import crypto from "crypto";
import { logActivity, ACTIVITY } from "../services/activityLog.service.js";

// Generate the authenticated user's personal QR
export async function generateQR(req, res, next) {
  try {
    const qr = await verificationService.getUserQR(req.user.id);
    res.json({ success: true, data: qr });
  } catch (err) {
    next(err);
  }
}

// Validate / process a scanned QR payload
export async function validateQR(req, res, next) {
  try {
    const result = await verificationService.processScan(req.user.id, req.validatedData.payload);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// List all machines (QR codes) — ADMIN only
export async function getGymQRCodes(req, res, next) {
  try {
    const machines = await prisma.machine.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: machines });
  } catch (err) {
    next(err);
  }
}

// Rotates a machine's QR token. ADMIN always; TRAINER only for existing machines.
export async function regenerateMachine(req, res, next) {
  try {
    const machine = await prisma.machine.findUnique({ where: { id: req.params.id } });
    if (!machine) {
      return res.status(404).json({ success: false, message: "Machine not found" });
    }
    const result = await verificationService.regenerateMachineQR(machine.id);
    await logActivity({ actorId: req.user.id, action: ACTIVITY.MACHINE_QR_REGENERATED, entityType: "Machine", entityId: machine.id, metadata: { machine: machine.name } });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// Deactivates (not deletes) a machine, preserving historical MachineUsage rows
export async function deactivateMachine(req, res, next) {
  try {
    const machine = await prisma.machine.findUnique({ where: { id: req.params.id } });
    if (!machine) {
      return res.status(404).json({ success: false, message: "Machine not found" });
    }
    const updated = await prisma.machine.update({
      where: { id: machine.id },
      data: { active: false },
    });
    await logActivity({ actorId: req.user.id, action: ACTIVITY.MACHINE_DEACTIVATED, entityType: "Machine", entityId: machine.id, metadata: { machine: machine.name } });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// Create a new machine and generate its initial QR token — ADMIN only
export async function createMachine(req, res, next) {
  try {
    const { name } = req.validatedData;
    const qrToken = crypto.randomBytes(16).toString("hex");
    const machine = await prisma.machine.create({
      data: { name, qrToken },
    });
    await logActivity({ actorId: req.user.id, action: ACTIVITY.MACHINE_CREATED, entityType: "Machine", entityId: machine.id, metadata: { machine: name } });

    res.status(201).json({ success: true, data: machine });
  } catch (err) {
    next(err);
  }
}