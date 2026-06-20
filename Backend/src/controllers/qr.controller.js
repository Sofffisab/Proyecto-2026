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
    const result = await verificationService.processScan(
      req.user.id,
      req.body.payload
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// List all machines (QR codes) for a gym — gymId is reserved for future multi-gym support
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

// Create a new machine and generate its initial QR token
export async function createMachine(req, res, next) {
  try {
    const { name } = req.body;
    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: "Machine name is required" });
    }

    const qrToken = crypto.randomBytes(16).toString("hex");
    const machine = await prisma.machine.create({
      data: { name, qrToken },
    });

    res.status(201).json({ success: true, data: machine });
  } catch (err) {
    next(err);
  }
}