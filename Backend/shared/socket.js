import jwt from "jsonwebtoken";
import { prisma } from "../prisma/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is required");
}

const connectedUsers = new Map();

export const setupSocketHandlers = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          fullName: true,
          username: true,
          role: true,
          tokenVersion: true,
        },
      });

      if (!user) {
        return next(new Error("User not found"));
      }

      if (decoded.tokenVersion !== user.tokenVersion) {
        return next(new Error("Token invalidated"));
      }

      socket.user = user;
      next();
    } catch (error) {
      console.error("[SOCKET] Auth error:", error.message);
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user.id;
    connectedUsers.set(userId, socket.id);

    console.log(`[SOCKET] User connected: ${socket.user.username} (${userId})`);

    socket.join(`user:${userId}`);

    if (socket.user.role === "TRAINER" || socket.user.role === "ADMIN") {
      socket.join("trainers");
    }

    if (socket.user.role === "ADMIN") {
      socket.join("admins");
    }

    socket.on("join_gym", () => {
      socket.join("gym");
      console.log(`[SOCKET] ${socket.user.username} joined gym room`);
    });

    socket.on("leave_gym", () => {
      socket.leave("gym");
      console.log(`[SOCKET] ${socket.user.username} left gym room`);
    });

    socket.on("disconnect", () => {
      connectedUsers.delete(userId);
      console.log(`[SOCKET] User disconnected: ${socket.user.username}`);
    });
  });
};

export const emitToUser = (io, userId, event, data) => {
  io.to(`user:${userId}`).emit(event, data);
};

export const emitToTrainers = (io, event, data) => {
  io.to("trainers").emit(event, data);
};

export const emitToAdmins = (io, event, data) => {
  io.to("admins").emit(event, data);
};

export const emitToGym = (io, event, data) => {
  io.to("gym").emit(event, data);
};

export const isUserOnline = (userId) => {
  return connectedUsers.has(userId);
};

export const getOnlineUsers = () => {
  return Array.from(connectedUsers.keys());
};