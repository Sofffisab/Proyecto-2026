import { prisma } from "../prisma/prisma.js";
import jwt from "jsonwebtoken";
import { ROLES } from "./utils.js";

const JWT_SECRET = process.env.JWT_SECRET;

// ============ SOCKET EVENTS CONSTANTS ============

export const SOCKET_EVENTS = {
  CONNECTION: "connect",
  DISCONNECT: "disconnect",
  AUTHENTICATE: "authenticate",
  AUTHENTICATED: "authenticated",
  AUTH_ERROR: "auth-error",
  ERROR: "error",
  HELP_REQUEST: "help-request",
  HELP_CLAIMED: "help-claimed",
  HELP_COMPLETED: "help-completed",
  HELP_CANCELLED: "help-cancelled",
  PROGRESS_REQUEST: "progress-request",
  PROGRESS_VERIFIED: "progress-verified",
  PROGRESS_DENIED: "progress-denied",
  SOCIAL_REQUEST: "social-request",
  SOCIAL_RESPONSE: "social-response",
  POINTS_UPDATED: "points-updated",
  NOTIFICATION: "notification",
  MACHINE_STATUS: "machine-status",
  JOIN_ROOM: "join-room",
  LEAVE_ROOM: "leave-room",
};

// ============ SOCKET HANDLERS ============

export const setupSocketHandlers = (io) => {
  global.io = io;

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error("No authentication token"));
      }

      const decoded = jwt.verify(token, JWT_SECRET);

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, tokenVersion: true, role: true, email: true, accountPaused: true },
      });

      if (!user) {
        return next(new Error("User not found"));
      }

      if (user.accountPaused) {
        return next(new Error("Account is paused"));
      }

      if (user.tokenVersion !== decoded.tokenVersion) {
        return next(new Error("Token has been revoked. Please login again."));
      }

      socket.userId = decoded.userId;
      socket.userRole = user.role;
      socket.userEmail = user.email;

      next();
    } catch (error) {
      console.error("[SOCKET] Authentication error:", error.message);
      next(new Error("Invalid authentication token"));
    }
  });

  io.on(SOCKET_EVENTS.CONNECTION, (socket) => {
    console.log(`[SOCKET] User connected: ${socket.userId}`);

    // Join user-specific room
    socket.join(`user-${socket.userId}`);

    // Join role-based rooms
    if (socket.userRole === ROLES.TRAINER) {
      socket.join("trainers");
    } else if (socket.userRole === ROLES.ADMIN) {
      socket.join("admins");
    }

    // Emit authenticated event
    socket.emit(SOCKET_EVENTS.AUTHENTICATED, {
      userId: socket.userId,
      role: socket.userRole,
      connectedAt: new Date(),
    });

    // ============ HELP SYSTEM EVENTS ============

    socket.on(SOCKET_EVENTS.HELP_REQUEST, async (data) => {
      try {
        console.log(`[SOCKET] Help request from user ${socket.userId}`);

        const user = await prisma.user.findUnique({
          where: { id: socket.userId },
          select: { id: true, fullName: true },
        });

        io.to("trainers").emit(SOCKET_EVENTS.HELP_REQUEST, {
          ...data,
          userId: socket.userId,
          userName: user?.fullName,
          requestedAt: new Date(),
        });
      } catch (error) {
        console.error("[SOCKET] Help request error:", error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Failed to send help request" });
      }
    });

    socket.on(SOCKET_EVENTS.HELP_CLAIMED, async (data) => {
      try {
        console.log(`[SOCKET] Help claimed by trainer ${socket.userId}`);

        io.to(`user-${data.userId}`).emit(SOCKET_EVENTS.HELP_CLAIMED, {
          ...data,
          trainerId: socket.userId,
          claimedAt: new Date(),
        });

        io.to("trainers").emit("help-claimed-update", data);
      } catch (error) {
        console.error("[SOCKET] Help claim error:", error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Failed to claim help" });
      }
    });

    socket.on(SOCKET_EVENTS.HELP_COMPLETED, async (data) => {
      try {
        console.log(`[SOCKET] Help completed by trainer ${socket.userId}`);

        io.to(`user-${data.userId}`).emit(SOCKET_EVENTS.HELP_COMPLETED, {
          ...data,
          completedAt: new Date(),
        });
      } catch (error) {
        console.error("[SOCKET] Help completion error:", error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Failed to complete help" });
      }
    });

    // ============ PROGRESS SYSTEM EVENTS ============

    socket.on(SOCKET_EVENTS.PROGRESS_REQUEST, async (data) => {
      try {
        console.log(`[SOCKET] Progress request from user ${socket.userId}`);

        io.to("trainers").emit(SOCKET_EVENTS.PROGRESS_REQUEST, {
          ...data,
          userId: socket.userId,
          requestedAt: new Date(),
        });
      } catch (error) {
        console.error("[SOCKET] Progress request error:", error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Failed to send progress request" });
      }
    });

    socket.on(SOCKET_EVENTS.PROGRESS_VERIFIED, async (data) => {
      try {
        console.log(`[SOCKET] Progress verified by trainer ${socket.userId}`);

        io.to(`user-${data.userId}`).emit(SOCKET_EVENTS.PROGRESS_VERIFIED, {
          ...data,
          verifiedAt: new Date(),
        });
      } catch (error) {
        console.error("[SOCKET] Progress verification error:", error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Failed to verify progress" });
      }
    });

    socket.on(SOCKET_EVENTS.PROGRESS_DENIED, async (data) => {
      try {
        console.log(`[SOCKET] Progress denied by trainer ${socket.userId}`);

        io.to(`user-${data.userId}`).emit(SOCKET_EVENTS.PROGRESS_DENIED, {
          ...data,
          deniedAt: new Date(),
        });
      } catch (error) {
        console.error("[SOCKET] Progress denial error:", error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Failed to deny progress" });
      }
    });

    // ============ SOCIAL EVENTS ============

    socket.on(SOCKET_EVENTS.SOCIAL_REQUEST, async (data) => {
      try {
        console.log(`[SOCKET] Social request from user ${socket.userId} to user ${data.receiverId}`);

        io.to(`user-${data.receiverId}`).emit(SOCKET_EVENTS.SOCIAL_REQUEST, {
          ...data,
          initiatorId: socket.userId,
          sentAt: new Date(),
        });
      } catch (error) {
        console.error("[SOCKET] Social request error:", error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Failed to send social request" });
      }
    });

    socket.on(SOCKET_EVENTS.SOCIAL_RESPONSE, async (data) => {
      try {
        console.log(`[SOCKET] Social response from user ${socket.userId}`);

        io.to(`user-${data.initiatorId}`).emit(SOCKET_EVENTS.SOCIAL_RESPONSE, {
          ...data,
          responderId: socket.userId,
          respondedAt: new Date(),
        });
      } catch (error) {
        console.error("[SOCKET] Social response error:", error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Failed to send social response" });
      }
    });

    // ============ POINTS EVENTS ============

    socket.on(SOCKET_EVENTS.POINTS_UPDATED, async (data) => {
      try {
        console.log(`[SOCKET] Points updated for user ${data.userId}`);

        io.emit(SOCKET_EVENTS.POINTS_UPDATED, {
          ...data,
          updatedAt: new Date(),
        });
      } catch (error) {
        console.error("[SOCKET] Points update error:", error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Failed to update points" });
      }
    });

    // ============ NOTIFICATIONS ============

    socket.on(SOCKET_EVENTS.NOTIFICATION, async (data) => {
      try {
        console.log(`[SOCKET] Notification for user ${data.userId}`);

        io.to(`user-${data.userId}`).emit(SOCKET_EVENTS.NOTIFICATION, {
          ...data,
          sentAt: new Date(),
        });
      } catch (error) {
        console.error("[SOCKET] Notification error:", error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Failed to send notification" });
      }
    });

    // ============ MACHINE STATUS ============

    socket.on(SOCKET_EVENTS.MACHINE_STATUS, async (data) => {
      try {
        console.log(`[SOCKET] Machine status update: ${data.machineId}`);

        io.emit(SOCKET_EVENTS.MACHINE_STATUS, {
          ...data,
          updatedAt: new Date(),
        });
      } catch (error) {
        console.error("[SOCKET] Machine status error:", error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Failed to update machine status" });
      }
    });

    // ============ ROOM MANAGEMENT ============

    socket.on(SOCKET_EVENTS.JOIN_ROOM, (data) => {
      const { room } = data;

      if (room) {
        socket.join(room);
        console.log(`[SOCKET] User ${socket.userId} joined room: ${room}`);
      }
    });

    socket.on(SOCKET_EVENTS.LEAVE_ROOM, (data) => {
      const { room } = data;

      if (room) {
        socket.leave(room);
        console.log(`[SOCKET] User ${socket.userId} left room: ${room}`);
      }
    });

    // ============ DISCONNECT ============

    socket.on(SOCKET_EVENTS.DISCONNECT, () => {
      console.log(`[SOCKET] User disconnected: ${socket.userId}`);
    });

    socket.on(SOCKET_EVENTS.ERROR, (error) => {
      console.error(`[SOCKET] Error from user ${socket.userId}:`, error);
    });
  });
};