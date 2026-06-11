import QRCode from "qrcode";
import { prisma } from "../prisma/prisma.js";
import {
  ERROR_CODES,
  QR_TYPES,
  generateQRCodeString,
  addDays,
  getGymPointsSettings,
  isGymOpen,
} from "../shared/utils.js";
import { sendPushAndNotification } from "./notifications.js";
import { emitToGym } from "../shared/socket.js";

// ============ QR GENERATION ============

export const generateMachineQR = async (req, res) => {
  const { machineId } = req.params;

  try {
    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
    });

    if (!machine) {
      return res.status(404).json({
        error: "Machine not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    // Invalidate any existing active QR for this machine
    await prisma.qRCode.updateMany({
      where: {
        machineId,
        isValid: true,
      },
      data: { isValid: false },
    });

    const code = generateQRCodeString();
    const image = await QRCode.toDataURL(code);
    const expiresAt = addDays(new Date(), 30);

    const qrCode = await prisma.qRCode.create({
      data: {
        code,
        image,
        type: QR_TYPES.MACHINE,
        machineId,
        expiresAt,
        nextRegenerationAt: expiresAt,
      },
    });

    return res.status(201).json({
      message: "Machine QR generated",
      qrCode: {
        id: qrCode.id,
        code: qrCode.code,
        image: qrCode.image,
        expiresAt: qrCode.expiresAt,
      },
    });
  } catch (error) {
    console.error("[QR] Generate machine QR error:", error);
    return res.status(500).json({
      error: "Failed to generate QR",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const generatePersonalQR = async (req, res) => {
  try {
    // Invalidate any existing active personal QR for this user
    await prisma.qRCode.updateMany({
      where: {
        userId: req.user.id,
        type: QR_TYPES.PERSONAL,
        isValid: true,
      },
      data: { isValid: false },
    });

    const code = generateQRCodeString();
    const image = await QRCode.toDataURL(code);
    const expiresAt = addDays(new Date(), 1);

    const qrCode = await prisma.qRCode.create({
      data: {
        code,
        image,
        type: QR_TYPES.PERSONAL,
        userId: req.user.id,
        expiresAt,
        nextRegenerationAt: expiresAt,
      },
    });

    return res.status(201).json({
      message: "Personal QR generated",
      qrCode: {
        id: qrCode.id,
        code: qrCode.code,
        image: qrCode.image,
        expiresAt: qrCode.expiresAt,
      },
    });
  } catch (error) {
    console.error("[QR] Generate personal QR error:", error);
    return res.status(500).json({
      error: "Failed to generate QR",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ QR SCANNING ============

export const scanQR = async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({
      error: "QR code is required",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const qrCode = await prisma.qRCode.findUnique({
      where: { code },
      include: {
        machine: true,
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            photoUrl: true,
          },
        },
      },
    });

    if (!qrCode) {
      return res.status(404).json({
        error: "QR code not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    if (!qrCode.isValid) {
      return res.status(400).json({
        error: "QR code is no longer valid",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    if (qrCode.expiresAt && new Date(qrCode.expiresAt) < new Date()) {
      return res.status(400).json({
        error: "QR code has expired",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    await prisma.qRScanLog.create({
      data: {
        qrCodeId: qrCode.id,
        scannedBy: req.user.id,
      },
    });

    return res.status(200).json({
      message: "QR code scanned successfully",
      qrCode: {
        type: qrCode.type,
        machine: qrCode.machine,
        user: qrCode.user,
      },
    });
  } catch (error) {
    console.error("[QR] Scan QR error:", error);
    return res.status(500).json({
      error: "Failed to scan QR",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ CHECK-IN / CHECK-OUT ============

export const checkIn = async (req, res) => {
  try {
    const settings = await getGymPointsSettings();

    // Validate gym is open
    if (!isGymOpen(settings)) {
      return res.status(400).json({
        error: `Gym is closed. Hours: ${settings.openTime} - ${settings.closeTime}`,
        code: ERROR_CODES.GYM_CLOSED,
      });
    }

    // Validate capacity
    const currentOccupancy = await prisma.checkIn.count({
      where: { exitTime: null },
    });

    if (currentOccupancy >= settings.maxCapacity) {
      return res.status(400).json({
        error: `Gym is at maximum capacity (${currentOccupancy}/${settings.maxCapacity})`,
        code: ERROR_CODES.GYM_AT_CAPACITY,
      });
    }

    const activeCheckIn = await prisma.checkIn.findFirst({
      where: {
        userId: req.user.id,
        exitTime: null,
      },
    });

    if (activeCheckIn) {
      return res.status(400).json({
        error: "You already have an active check-in",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    const [checkIn, _] = await prisma.$transaction([
      prisma.checkIn.create({
        data: { userId: req.user.id },
      }),
      prisma.userPoints.update({
        where: { userId: req.user.id },
        data: {
          totalPoints: { increment: settings.pointsPerCheckIn },
          currentPoints: { increment: settings.pointsPerCheckIn },
        },
      }),
    ]);

    await sendPushAndNotification(
      req.user.id,
      "check_in",
      "Check-in Successful",
      `Welcome! You earned ${settings.pointsPerCheckIn} points.`,
      { checkInId: checkIn.id }
    );

    const io = req.app.get("io");
    emitToGym(io, "user_checked_in", {
      userId: req.user.id,
      username: req.user.username,
    });

    return res.status(201).json({
      message: "Check-in successful",
      checkIn,
      pointsEarned: settings.pointsPerCheckIn,
      currentOccupancy: currentOccupancy + 1,
      maxCapacity: settings.maxCapacity,
    });
  } catch (error) {
    console.error("[QR] Check-in error:", error);
    return res.status(500).json({
      error: "Failed to check in",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const checkOut = async (req, res) => {
  try {
    const activeCheckIn = await prisma.checkIn.findFirst({
      where: {
        userId: req.user.id,
        exitTime: null,
      },
    });

    if (!activeCheckIn) {
      return res.status(400).json({
        error: "No active check-in found",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    // End any active machine usages
    await prisma.machineUsage.updateMany({
      where: {
        userId: req.user.id,
        endTime: null,
      },
      data: { endTime: new Date() },
    });

    const checkIn = await prisma.checkIn.update({
      where: { id: activeCheckIn.id },
      data: { exitTime: new Date() },
    });

    await sendPushAndNotification(
      req.user.id,
      "check_out",
      "Check-out Successful",
      "Thanks for visiting! See you next time.",
      { checkInId: checkIn.id }
    );

    const io = req.app.get("io");
    emitToGym(io, "user_checked_out", {
      userId: req.user.id,
      username: req.user.username,
    });

    return res.status(200).json({
      message: "Check-out successful",
      checkIn,
    });
  } catch (error) {
    console.error("[QR] Check-out error:", error);
    return res.status(500).json({
      error: "Failed to check out",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const getActiveCheckIn = async (req, res) => {
  try {
    const activeCheckIn = await prisma.checkIn.findFirst({
      where: {
        userId: req.user.id,
        exitTime: null,
      },
    });

    return res.status(200).json({
      activeCheckIn,
    });
  } catch (error) {
    console.error("[QR] Get active check-in error:", error);
    return res.status(500).json({
      error: "Failed to get active check-in",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ MACHINE USAGE ============

export const startMachineUsage = async (req, res) => {
  const { machineId } = req.params;

  try {
    const activeCheckIn = await prisma.checkIn.findFirst({
      where: {
        userId: req.user.id,
        exitTime: null,
      },
    });

    if (!activeCheckIn) {
      return res.status(400).json({
        error: "You must be checked in to use machines",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
    });

    if (!machine) {
      return res.status(404).json({
        error: "Machine not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    if (machine.status !== "available") {
      return res.status(400).json({
        error: "Machine is not available",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    const existingUsage = await prisma.machineUsage.findFirst({
      where: {
        userId: req.user.id,
        endTime: null,
      },
    });

    if (existingUsage) {
      return res.status(400).json({
        error: "You are already using another machine",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    const [usage, _] = await prisma.$transaction([
      prisma.machineUsage.create({
        data: {
          machineId,
          userId: req.user.id,
        },
      }),
      prisma.machine.update({
        where: { id: machineId },
        data: { status: "in_use" },
      }),
    ]);

    const io = req.app.get("io");
    emitToGym(io, "machine_status_changed", {
      machineId,
      status: "in_use",
      userId: req.user.id,
    });

    return res.status(201).json({
      message: "Machine usage started",
      usage,
    });
  } catch (error) {
    console.error("[QR] Start machine usage error:", error);
    return res.status(500).json({
      error: "Failed to start machine usage",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const endMachineUsage = async (req, res) => {
  const { machineId } = req.params;

  try {
    const activeUsage = await prisma.machineUsage.findFirst({
      where: {
        machineId,
        userId: req.user.id,
        endTime: null,
      },
    });

    if (!activeUsage) {
      return res.status(400).json({
        error: "No active usage found for this machine",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    const [usage, _] = await prisma.$transaction([
      prisma.machineUsage.update({
        where: { id: activeUsage.id },
        data: { endTime: new Date() },
      }),
      prisma.machine.update({
        where: { id: machineId },
        data: { status: "available" },
      }),
    ]);

    await sendPushAndNotification(
      req.user.id,
      "machine_used",
      "Workout Tracked",
      `You finished using the machine.`,
      { machineId, usageId: usage.id }
    );

    const io = req.app.get("io");
    emitToGym(io, "machine_status_changed", {
      machineId,
      status: "available",
      userId: null,
    });

    return res.status(200).json({
      message: "Machine usage ended",
      usage,
    });
  } catch (error) {
    console.error("[QR] End machine usage error:", error);
    return res.status(500).json({
      error: "Failed to end machine usage",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const getMachineUsageHistory = async (req, res) => {
  const { machineId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  try {
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [usages, total] = await Promise.all([
      prisma.machineUsage.findMany({
        where: { machineId },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              username: true,
              photoUrl: true,
            },
          },
        },
        orderBy: { startTime: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.machineUsage.count({ where: { machineId } }),
    ]);

    return res.status(200).json({
      usages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[QR] Get machine usage history error:", error);
    return res.status(500).json({
      error: "Failed to get usage history",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ ENTRY/EXIT QR ============

export const generateEntryExitQR = async (req, res) => {

  try {

    const qrType = QR_TYPES.ENTRY_EXIT;

    await prisma.qRCode.updateMany({
      where: {
        type: qrType,
        isValid: true,
      },
      data: { isValid: false },
    });

    const code = generateQRCodeString();
    const image = await QRCode.toDataURL(code);
    const expiresAt = addDays(new Date(), 7);

    const qrCode = await prisma.qRCode.create({
      data: {
        code,
        image,
        type: qrType,
        expiresAt,
        nextRegenerationAt: expiresAt,
      },
    });

    return res.status(201).json({
      message: "Entry/Exit QR generated",
      qrCode: {
        id: qrCode.id,
        code: qrCode.code,
        image: qrCode.image,
        expiresAt: qrCode.expiresAt,
      },
    });
  } catch (error) {
    console.error("[QR] Generate entry/exit QR error:", error);
    return res.status(500).json({
      error: "Failed to generate QR",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ REGENERATE QR ============

export const regenerateQR = async (req, res) => {
  const { qrCodeId } = req.params;

  try {
    const existingQR = await prisma.qRCode.findUnique({
      where: { id: qrCodeId },
    });

    if (!existingQR) {
      return res.status(404).json({
        error: "QR code not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    // Invalidate old QR
    await prisma.qRCode.update({
      where: { id: qrCodeId },
      data: { isValid: false },
    });

    // Generate new QR
    const code = generateQRCodeString();
    const image = await QRCode.toDataURL(code);
    const expiresAt = addDays(new Date(), existingQR.type === QR_TYPES.PERSONAL ? 1 : 30);

    const qrCode = await prisma.qRCode.create({
      data: {
        code,
        image,
        type: existingQR.type,
        machineId: existingQR.machineId,
        userId: existingQR.userId,
        expiresAt,
        nextRegenerationAt: expiresAt,
      },
    });

    return res.status(201).json({
      message: "QR regenerated",
      qrCode: {
        id: qrCode.id,
        code: qrCode.code,
        image: qrCode.image,
        expiresAt: qrCode.expiresAt,
      },
    });
  } catch (error) {
    console.error("[QR] Regenerate QR error:", error);
    return res.status(500).json({
      error: "Failed to regenerate QR",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ GET QR CODES ============

export const getQRCodes = async (req, res) => {
  const { type, page = 1, limit = 20 } = req.query;

  try {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { isValid: true };
    if (type) where.type = type;

    const [qrCodes, total] = await Promise.all([
      prisma.qRCode.findMany({
        where,
        include: {
          machine: {
            select: { id: true, name: true },
          },
          user: {
            select: { id: true, fullName: true, username: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.qRCode.count({ where }),
    ]);

    return res.status(200).json({
      qrCodes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[QR] Get QR codes error:", error);
    return res.status(500).json({
      error: "Failed to get QR codes",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ USE MACHINE (ALIAS) ============

export const useMachine = async (req, res) => {
  const { machineId, action } = req.body;

  if (!machineId || !action) {
    return res.status(400).json({
      error: "Machine ID and action are required",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  if (action === "start") {
    req.params.machineId = machineId;
    return startMachineUsage(req, res);
  } else if (action === "end") {
    req.params.machineId = machineId;
    return endMachineUsage(req, res);
  } else {
    return res.status(400).json({
      error: "Action must be 'start' or 'end'",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
};

// ============ CHECK-IN HISTORY ============

export const getCheckInHistory = async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  try {
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [checkIns, total] = await Promise.all([
      prisma.checkIn.findMany({
        where: { userId },
        orderBy: { entryTime: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.checkIn.count({ where: { userId } }),
    ]);

    return res.status(200).json({
      checkIns,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[QR] Get check-in history error:", error);
    return res.status(500).json({
      error: "Failed to get check-in history",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};