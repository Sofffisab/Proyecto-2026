import * as verificationService from "../services/verification.service.js";
import prisma from "../config/prisma.js";
import crypto from "crypto";

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
    // req.validatedData from validateQRSchema guarantees { payload } is a non-empty string.
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

// Manually rotate a single machine's QR token. ADMIN can always do this;
// a TRAINER can only rotate a QR that already exists (they cannot create a
// new machine — that stays ADMIN-only via createMachine below).
export async function regenerateMachine(req, res, next) {
  try {
    const machine = await prisma.machine.findUnique({ where: { id: req.params.id } });
    if (!machine) {
      return res.status(404).json({ success: false, message: "Machine not found" });
    }
    const result = await verificationService.regenerateMachineQR(machine.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// Remove a machine from the gym floor (broken / retired). We deactivate
// instead of hard-deleting so historical MachineUsage rows stay intact —
// ADMIN only, same as creating one.
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
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// Create a new machine and generate its initial QR token — ADMIN only
export async function createMachine(req, res, next) {
  try {
    // `name` comes from req.body directly here because there is no dedicated
    // createMachineSchema yet. The check below acts as a minimal guard until
    // a proper schema is added to progress.schemas.js.
  const { name } = req.validatedData; // validated & trimmed by createMachineSchema
  const qrToken = crypto.randomBytes(16).toString("hex");
  const machine = await prisma.machine.create({
    data: { name, qrToken },
  });

    res.status(201).json({ success: true, data: machine });
  } catch (err) {
    next(err);
  }
}