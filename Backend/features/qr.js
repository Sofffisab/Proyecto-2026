import { prisma } from "../prisma/prisma.js";
import QRCode from "qrcode";
import { v4 as uuid } from "uuid";
import { sendPushAndNotification } from "./notifications.js";
import { NOTIFICATION_TYPES, QR_TYPES, generateQRCodeString, isExpired } from "../shared/utils.js";

// ============ QR SERVICE ============

export const generateQRCode = async (qrData, userId, regenerationSchedule = null) => {
  try {
    const qrCodeString = generateQRCodeString();
    const qrImage = await QRCode.toDataURL(qrCodeString);

    let nextRegenerationAt = null;
    if (regenerationSchedule) {
      const nextDate = new Date();
      if (regenerationSchedule === "daily") {
        nextDate.setDate(nextDate.getDate() + 1);
      } else if (regenerationSchedule === "weekly") {
        nextDate.setDate(nextDate.getDate() + 7);
      }
      nextRegenerationAt = nextDate;
    }

    const qrCode = await prisma.qRCode.create({
      data: {
        id: uuid(),
        code: qrCodeString,
        image: qrImage,
        type: qrData.type,
        machineId: qrData.machineId || null,
        userId: userId || null,
        isValid: true,
        regenerationSchedule,
        nextRegenerationAt,
        expiresAt: qrData.expiresAt || null,
      },
    });

    return qrCode;
  } catch (error) {
    console.error("[QR] Generate QR code error:", error);
    throw error;
  }
};

export const validateQRCode = async (code) => {
  const qrCode = await prisma.qRCode.findFirst({
    where: {
      code,
      isValid: true,
    },
  });

  if (!qrCode) return null;

  if (qrCode.expiresAt && isExpired(qrCode.expiresAt)) {
    await prisma.qRCode.update({
      where: { id: qrCode.id },
      data: { isValid: false },
    });
    return null;
  }

  return qrCode;
};

export const regenerateQRCode = async (qrCodeId) => {
  try {
    const existingQR = await prisma.qRCode.findUnique({
      where: { id: qrCodeId },
    });

    if (!existingQR) return null;

    const newQRCodeString = generateQRCodeString();
    const newQRImage = await QRCode.toDataURL(newQRCodeString);

    let nextRegenerationAt = null;
    if (existingQR.regenerationSchedule) {
      const nextDate = new Date();
      if (existingQR.regenerationSchedule === "daily") {
        nextDate.setDate(nextDate.getDate() + 1);
      } else if (existingQR.regenerationSchedule === "weekly") {
        nextDate.setDate(nextDate.getDate() + 7);
      }
      nextRegenerationAt = nextDate;
    }

    const updatedQR = await prisma.qRCode.update({
      where: { id: qrCodeId },
      data: {
        code: newQRCodeString,
        image: newQRImage,
        nextRegenerationAt,
      },
    });

    return updatedQR;
  } catch (error) {
    console.error("[QR] Regenerate QR code error:", error);
    throw error;
  }
};

export const getQRImage = async (qrCodeId) => {
  const qrCode = await prisma.qRCode.findUnique({
    where: { id: qrCodeId },
  });

  return qrCode?.image || null;
};

export const getActiveQRByType = async (type, machineId = null, userId = null) => {
  return await prisma.qRCode.findFirst({
    where: {
      type,
      isValid: true,
      ...(machineId && { machineId }),
      ...(userId && { userId }),
    },
  });
};

// ============ QR CONTROLLERS ============

export const generateMachineQR = async (req, res) => {
  try {
    const { machineId, regenerationSchedule, expiresAt } = req.body;

    if (!machineId) {
      return res.status(400).json({ error: "Machine ID is required" });
    }

    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
    });

    if (!machine) {
      return res.status(404).json({ error: "Machine not found" });
    }

    const qrCode = await generateQRCode(
      {
        type: QR_TYPES.MACHINE,
        machineId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      null,
      regenerationSchedule
    );

    res.status(201).json({
      message: "Machine QR code generated",
      qrCode,
    });
  } catch (error) {
    console.error("[QR] Generate machine QR error:", error);
    res.status(500).json({ error: "Failed to generate QR code" });
  }
};

export const generatePersonalQR = async (req, res) => {
  try {
    const { regenerationSchedule, expiresAt } = req.body;

    const qrCode = await generateQRCode(
      {
        type: QR_TYPES.PERSONAL,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      req.userId,
      regenerationSchedule
    );

    res.status(201).json({
      message: "Personal QR code generated",
      qrCode,
    });
  } catch (error) {
    console.error("[QR] Generate personal QR error:", error);
    res.status(500).json({ error: "Failed to generate personal QR code" });
  }
};

export const generateEntryExitQR = async (req, res) => {
  try {
    const { regenerationSchedule } = req.body;

    const qrCode = await generateQRCode(
      {
        type: QR_TYPES.ENTRY_EXIT,
      },
      null,
      regenerationSchedule
    );

    res.status(201).json({
      message: "Entry/Exit QR code generated",
      qrCode,
    });
  } catch (error) {
    console.error("[QR] Generate entry/exit QR error:", error);
    res.status(500).json({ error: "Failed to generate entry/exit QR code" });
  }
};

export const scanQR = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "QR code is required" });
    }

    const qrCode = await validateQRCode(code);

    if (!qrCode) {
      return res.status(404).json({ error: "Invalid or expired QR code" });
    }

    await prisma.qRScanLog.create({
      data: {
        id: uuid(),
        qrCodeId: qrCode.id,
        scannedBy: req.userId,
        scannedAt: new Date(),
      },
    });

    res.status(200).json({
      message: "QR code scanned successfully",
      qrCode,
    });
  } catch (error) {
    console.error("[QR] Scan QR error:", error);
    res.status(500).json({ error: "Failed to scan QR code" });
  }
};

export const regenerateQR = async (req, res) => {
  try {
    const { qrCodeId } = req.params;

    const qrCode = await regenerateQRCode(qrCodeId);

    if (!qrCode) {
      return res.status(404).json({ error: "QR code not found" });
    }

    res.status(200).json({
      message: "QR code regenerated successfully",
      qrCode,
    });
  } catch (error) {
    console.error("[QR] Regenerate QR error:", error);
    res.status(500).json({ error: "Failed to regenerate QR code" });
  }
};

export const getQRCodes = async (req, res) => {
  try {
    const qrCodes = await prisma.qRCode.findMany({
      where: { isValid: true },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(qrCodes);
  } catch (error) {
    console.error("[QR] Get QR codes error:", error);
    res.status(500).json({ error: "Failed to get QR codes" });
  }
};

// ============ CHECK-IN SERVICE ============

export const processCheckIn = async (userId) => {
  const checkIn = await prisma.checkIn.create({
    data: {
      id: uuid(),
      userId,
      entryTime: new Date(),
    },
  });

  return checkIn;
};

export const processCheckOut = async (checkInId) => {
  const checkIn = await prisma.checkIn.update({
    where: { id: checkInId },
    data: { exitTime: new Date() },
  });

  return checkIn;
};

export const calculateDuration = (entryTime, exitTime) => {
  const duration = Math.floor((exitTime - entryTime) / 1000 / 60);
  return duration;
};

// ============ CHECK-IN CONTROLLERS ============

export const checkIn = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user || !user.profileComplete) {
      return res.status(400).json({ error: "Profile must be complete to check in" });
    }

    const activeCheckIn = await prisma.checkIn.findFirst({
      where: {
        userId: req.userId,
        exitTime: null,
      },
    });

    if (activeCheckIn) {
      return res.status(400).json({ error: "Already checked in" });
    }

    const checkIn = await processCheckIn(req.userId);

    await sendPushAndNotification(
      req.userId,
      NOTIFICATION_TYPES.CHECK_IN,
      "Check-In Successful",
      "You have checked in to the gym",
      { checkInId: checkIn.id }
    );

    // Emit socket event
    const io = req.app.get("io");
    io.emit("checkin:new", {
      userId: req.userId,
      checkInId: checkIn.id,
      entryTime: checkIn.entryTime,
    });

    res.status(201).json({
      message: "Check-in successful",
      checkIn,
    });
  } catch (error) {
    console.error("[CHECK-IN] Check-in error:", error);
    res.status(500).json({ error: "Check-in failed" });
  }
};

export const checkOut = async (req, res) => {
  try {
    const activeCheckIn = await prisma.checkIn.findFirst({
      where: {
        userId: req.userId,
        exitTime: null,
      },
    });

    if (!activeCheckIn) {
      return res.status(400).json({ error: "No active check-in found" });
    }

    const checkOut = await processCheckOut(activeCheckIn.id);
    const duration = calculateDuration(activeCheckIn.entryTime, checkOut.exitTime);

    // Award points for workout
    const points = Math.floor(duration / 10);
    if (points > 0) {
      await prisma.userPoints.update({
        where: { userId: req.userId },
        data: {
          currentPoints: { increment: points },
          totalPoints: { increment: points },
        },
      });

      await sendPushAndNotification(
        req.userId,
        NOTIFICATION_TYPES.POINTS_EARNED,
        "Points Earned",
        `You earned ${points} points for your workout`,
        { points, duration }
      );
    }

    await sendPushAndNotification(
      req.userId,
      NOTIFICATION_TYPES.CHECK_OUT,
      "Check-Out Successful",
      `You checked out after ${duration} minutes`,
      { checkOutId: checkOut.id, duration }
    );

    // Emit socket event
    const io = req.app.get("io");
    io.emit("checkin:completed", {
      userId: req.userId,
      checkInId: checkOut.id,
      exitTime: checkOut.exitTime,
      duration,
      pointsEarned: points,
    });

    res.status(200).json({
      message: "Check-out successful",
      checkOut,
      duration,
      pointsEarned: points,
    });
  } catch (error) {
    console.error("[CHECK-IN] Check-out error:", error);
    res.status(500).json({ error: "Check-out failed" });
  }
};

export const getActiveCheckIn = async (req, res) => {
  try {
    const activeCheckIn = await prisma.checkIn.findFirst({
      where: {
        userId: req.userId,
        exitTime: null,
      },
    });

    if (!activeCheckIn) {
      return res.status(404).json({ error: "No active check-in" });
    }

    res.status(200).json(activeCheckIn);
  } catch (error) {
    console.error("[CHECK-IN] Get active check-in error:", error);
    res.status(500).json({ error: "Failed to get active check-in" });
  }
};

export const getCheckInHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    const checkIns = await prisma.checkIn.findMany({
      where: { userId },
      orderBy: { entryTime: "desc" },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    res.status(200).json(checkIns);
  } catch (error) {
    console.error("[CHECK-IN] Get history error:", error);
    res.status(500).json({ error: "Failed to get check-in history" });
  }
};

export const useMachine = async (req, res) => {
  try {
    const { machineId } = req.body;

    if (!machineId) {
      return res.status(400).json({ error: "Machine ID is required" });
    }

    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
    });

    if (!machine) {
      return res.status(404).json({ error: "Machine not found" });
    }

    const machineUsage = await prisma.machineUsage.create({
      data: {
        id: uuid(),
        machineId,
        userId: req.userId,
        startTime: new Date(),
      },
    });

    await sendPushAndNotification(
      req.userId,
      NOTIFICATION_TYPES.MACHINE_USED,
      "Machine Usage Started",
      `You started using ${machine.name}`,
      { machineId, machineUsage: machineUsage.id }
    );

    // Emit socket event
    const io = req.app.get("io");
    io.emit("machine:inuse", {
      machineId,
      userId: req.userId,
      usageId: machineUsage.id,
    });

    res.status(201).json({
      message: "Machine usage started",
      machineUsage,
    });
  } catch (error) {
    console.error("[MACHINES] Use machine error:", error);
    res.status(500).json({ error: "Failed to start machine usage" });
  }
};