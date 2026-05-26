import { v4 as uuid } from "uuid";
import { prisma } from "../prisma/prisma.js";

// ============ CONSTANTS ============

export const ROLES = {
  USER: "USER",
  TRAINER: "TRAINER",
  ADMIN: "ADMIN",
};

export const QR_TYPES = {
  MACHINE: "machine",
  PERSONAL: "personal",
  ENTRY_EXIT: "entry_exit",
};

export const NOTIFICATION_TYPES = {
  CHECK_IN: "check_in",
  CHECK_OUT: "check_out",
  POINTS_EARNED: "points_earned",
  POINTS_DEDUCTED: "points_deducted",
  REWARD_CLAIMED: "reward_claimed",
  REWARD_APPROVED: "reward_approved",
  REWARD_DENIED: "reward_denied",
  HELP_REQUESTED: "help_requested",
  HELP_CLAIMED: "help_claimed",
  HELP_COMPLETED: "help_completed",
  PROGRESS_REQUESTED: "progress_requested",
  PROGRESS_APPROVED: "progress_approved",
  PROGRESS_DENIED: "progress_denied",
  SOCIAL_REQUEST: "social_request",
  SOCIAL_ACCEPTED: "social_accepted",
  SOCIAL_REJECTED: "social_rejected",
  MACHINE_USED: "machine_used",
  REMINDER: "reminder",
  ACCOUNT_PAUSED: "account_paused",
  ROLE_CHANGED: "role_changed",
  HELP_CALLED: "help_called",
};

export const STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  DENIED: "denied",
  CLAIMED: "claimed",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
};

export const ERROR_CODES = {
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DUPLICATE_ENTRY: "DUPLICATE_ENTRY",
  INSUFFICIENT_POINTS: "INSUFFICIENT_POINTS",
  GYM_CLOSED: "GYM_CLOSED",
  GYM_AT_CAPACITY: "GYM_AT_CAPACITY",
};

// ============ VALIDATORS ============

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password) => {
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

export const validateUsername = (username) => {
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
};

export const validateRole = (role) => {
  return Object.values(ROLES).includes(role);
};

export const validateRating = (rating) => {
  return typeof rating === "number" && Number.isInteger(rating) && rating >= 1 && rating <= 5;
};

// ============ FORMATTERS ============

export const formatDate = (date) => {
  return new Date(date).toISOString();
};

export const formatDateShort = (date) => {
  return new Date(date).toISOString().split("T")[0];
};

export const formatTime = (date) => {
  return new Date(date).toISOString().split("T")[1].substring(0, 5);
};

export const formatDuration = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

export const formatPoints = (points) => {
  return points.toLocaleString();
};

// ============ HELPERS ============

export const generateQRCodeString = () => {
  return `QR-${uuid()}-${Date.now()}`;
};

export const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const subMinutes = (date, minutes) => {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() - minutes);
  return result;
};

export const isExpired = (expiresAt) => {
  return new Date(expiresAt) < new Date();
};

export const calculateDurationMinutes = (startTime, endTime) => {
  return Math.floor((new Date(endTime) - new Date(startTime)) / 1000 / 60);
};

export const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const paginate = (page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  return { take: limit, skip: offset };
};

export const sanitizeString = (str) => {
  if (!str) return "";
  return str.trim().replace(/[<>]/g, "");
};

export const parseJSON = (str, fallback = null) => {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

// ============ PAGINATION HELPERS ============

export const parsePaginationParams = (query) => {
  const limit = Math.max(1, Math.min(100, parseInt(query.limit) || 20));
  const offset = Math.max(0, parseInt(query.offset) || 0);
  return { limit, offset };
};

// ============ SHARED SERVICES ============

export const getGymPointsSettings = async () => {
  let settings = await prisma.gymSettings.findFirst();
  if (!settings) {
    settings = await prisma.gymSettings.create({
      data: {
        gymName: "My Gym",
        openTime: "06:00",
        closeTime: "22:00",
        maxCapacity: 100,
        pointsPerCheckIn: 10,
        pointsPerHelpReceived: 50,
        pointsPerProgressVerified: 100,
        pointsPerSocialConnection: 25,
      },
    });
  }
  return settings;
};

export const isGymOpen = (settings) => {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return currentTime >= settings.openTime && currentTime <= settings.closeTime;
};

export const formatUserPhoto = (photoUrl) => {
  if (!photoUrl) return null;
  if (photoUrl.startsWith("http")) return photoUrl;
  return photoUrl;
};