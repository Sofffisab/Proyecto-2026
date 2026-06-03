import { Router } from "express";
import multer from "multer";

import * as auth from "./features/auth.js";
import * as users from "./features/users.js";
import * as qr from "./features/qr.js";
import * as gamification from "./features/gamification.js";
import * as notifications from "./features/notifications.js";
import * as assistance from "./features/assistance.js";
import * as social from "./features/social.js";
import * as admin from "./features/admin.js";
import * as trainer from "./features/trainer.js";

import {
  requireAuth,
  requireRole,
  requireSelfOrAdmin,
  requireSelfOrTrainer,
  requireProfileComplete,
} from "./shared/middlewares.js";
import { ROLES } from "./shared/utils.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/auth/login", auth.login);
router.post("/auth/register", upload.single("photo"), auth.register);
router.post("/auth/refresh", auth.refreshToken);
router.get("/auth/validate", requireAuth, auth.validate);
router.post("/auth/logout", requireAuth, auth.logout);

router.get("/users/me", requireAuth, users.getCurrentUser);
router.get("/users/:userId", requireAuth, requireSelfOrAdmin, users.getUser);
router.put("/users/:userId", requireAuth, requireSelfOrAdmin, upload.single("photo"), users.updateUser);
router.delete("/users/:userId", requireAuth, requireSelfOrAdmin, users.deleteUser);
router.patch("/users/:userId/pause", requireAuth, requireSelfOrAdmin, users.pauseAccount);
router.get("/users/:userId/settings", requireAuth, requireSelfOrAdmin, users.getSettings);
router.put("/users/:userId/settings", requireAuth, requireSelfOrAdmin, users.updateSettings);
router.post("/users/push-token", requireAuth, users.updatePushToken);
router.get("/users/:userId/wrapped", requireAuth, requireSelfOrAdmin, users.getWrapped);

router.get("/profiles/:userId", requireAuth, requireSelfOrTrainer, users.getProfile);
router.put("/profiles/:userId", requireAuth, requireSelfOrAdmin, users.updateProfile);
router.post("/profiles/:userId/complete", requireAuth, requireSelfOrAdmin, users.completeProfile);
router.get("/profiles/:userId/status", requireAuth, requireSelfOrAdmin, users.getProfileStatus);

router.get("/personalizations/:userId", requireAuth, requireSelfOrAdmin, users.getPersonalizations);
router.post("/personalizations/:userId", requireAuth, requireSelfOrAdmin, users.setPersonalization);
router.delete("/personalizations/:userId/:fieldName", requireAuth, requireSelfOrAdmin, users.deletePersonalization);

router.post("/qr/machine/:machineId", requireAuth, requireRole(ROLES.ADMIN), qr.generateMachineQR);
router.post("/qr/personal", requireAuth, qr.generatePersonalQR);
router.post("/qr/entry-exit", requireAuth, requireRole(ROLES.ADMIN), qr.generateEntryExitQR);
router.post("/qr/scan", requireAuth, qr.scanQR);
router.post("/qr/:qrCodeId/regenerate", requireAuth, requireRole(ROLES.ADMIN), qr.regenerateQR);
router.get("/qr", requireAuth, requireRole(ROLES.ADMIN, ROLES.TRAINER), qr.getQRCodes);

router.post("/checkin", requireAuth, requireProfileComplete, qr.checkIn);
router.post("/checkout", requireAuth, qr.checkOut);
router.get("/checkin/active", requireAuth, qr.getActiveCheckIn);
router.get("/checkin/history/:userId", requireAuth, requireSelfOrTrainer, qr.getCheckInHistory);
router.post("/checkin/machine", requireAuth, requireProfileComplete, qr.useMachine);

router.post("/progress", requireAuth, requireProfileComplete, assistance.requestProgressUpdateCtrl);
router.post("/progress/:progressId/verify", requireAuth, requireRole(ROLES.TRAINER, ROLES.ADMIN), assistance.verifyProgressCtrl);
router.get("/progress/pending", requireAuth, requireRole(ROLES.TRAINER, ROLES.ADMIN), assistance.getPendingProgress);
router.get("/progress/:userId", requireAuth, requireSelfOrTrainer, assistance.getUserProgress);

router.get("/points/:userId", requireAuth, requireSelfOrAdmin, gamification.getPoints);
router.post("/points/:userId/add", requireAuth, requireRole(ROLES.ADMIN), gamification.addPointsManual);
router.post("/points/:userId/deduct", requireAuth, requireRole(ROLES.ADMIN), gamification.deductPointsManual);
router.get("/leaderboard", requireAuth, gamification.getLeaderboard);

router.get("/rewards", requireAuth, gamification.getRewards);
router.post("/rewards", requireAuth, requireRole(ROLES.ADMIN), gamification.createReward);
router.put("/rewards/:rewardId", requireAuth, requireRole(ROLES.ADMIN), gamification.updateReward);
router.post("/rewards/:rewardId/claim", requireAuth, requireProfileComplete, gamification.claimReward);
router.post("/rewards/claims/:claimId/verify", requireAuth, requireRole(ROLES.TRAINER, ROLES.ADMIN), gamification.verifyRewardClaim);
router.get("/rewards/claims/pending", requireAuth, requireRole(ROLES.TRAINER, ROLES.ADMIN), gamification.getPendingClaims);
router.get("/rewards/claims/:userId", requireAuth, requireSelfOrAdmin, gamification.getUserClaims);

router.get("/notifications", requireAuth, notifications.getNotifications);
router.patch("/notifications/:notificationId/read", requireAuth, notifications.markAsRead);
router.patch("/notifications/read-all", requireAuth, notifications.markAllAsRead);
router.get("/notifications/unread-count", requireAuth, notifications.getUnreadCount);
router.delete("/notifications/:notificationId", requireAuth, notifications.deleteNotification);
router.delete("/notifications", requireAuth, notifications.clearNotifications);

router.post("/help", requireAuth, requireProfileComplete, assistance.requestHelp);
router.post("/help/:helpId/claim", requireAuth, requireRole(ROLES.TRAINER, ROLES.ADMIN), assistance.claimHelpRequestCtrl);
router.post("/help/:helpId/complete", requireAuth, requireRole(ROLES.TRAINER, ROLES.ADMIN), assistance.completeHelpRequestCtrl);
router.post("/help/:helpId/rate", requireAuth, assistance.rateHelp);
router.get("/help/pending", requireAuth, requireRole(ROLES.TRAINER, ROLES.ADMIN), assistance.getPendingHelpRequests);
router.get("/help/my-requests", requireAuth, assistance.getMyHelpRequests);
router.delete("/help/:helpId", requireAuth, assistance.cancelHelpRequest);

router.get("/statistics/gym", requireAuth, requireRole(ROLES.ADMIN), admin.getGymStats);
router.get("/statistics/employee/:trainerId", requireAuth, requireRole(ROLES.ADMIN), admin.getEmployeeStats);
router.get("/statistics/machine/:machineId", requireAuth, requireRole(ROLES.ADMIN), admin.getMachineStats);
router.get("/statistics/machines", requireAuth, requireRole(ROLES.ADMIN), admin.getAllMachineStats);
router.get("/statistics/reports", requireAuth, requireRole(ROLES.ADMIN), admin.getReports);
router.post("/statistics/reports", requireAuth, requireRole(ROLES.ADMIN), admin.generateReportCtrl);

router.get("/routines/:userId", requireAuth, requireSelfOrTrainer, admin.getRoutines);
router.post("/routines", requireAuth, admin.createRoutine);
router.put("/routines/:routineId", requireAuth, admin.updateRoutine);
router.delete("/routines/:routineId", requireAuth, admin.deleteRoutine);

router.post("/social/interact", requireAuth, requireProfileComplete, social.initiateInteraction);
router.post("/social/:interactionId/confirm", requireAuth, social.confirmInteraction);
router.get("/social/interactions", requireAuth, social.getMyInteractions);
router.get("/social/pending", requireAuth, social.getPendingRequests);

router.get("/machines", requireAuth, admin.getMachines);
router.get("/machines/:machineId", requireAuth, admin.getMachine);
router.post("/machines", requireAuth, requireRole(ROLES.ADMIN), admin.createMachine);
router.put("/machines/:machineId", requireAuth, requireRole(ROLES.ADMIN), admin.updateMachine);
router.delete("/machines/:machineId", requireAuth, requireRole(ROLES.ADMIN), admin.deleteMachine);

router.post("/reviews", requireAuth, admin.createReview);
router.get("/reviews/machine/:machineId", requireAuth, admin.getMachineReviews);
router.get("/reviews/trainer/:trainerId", requireAuth, admin.getTrainerReviews);
router.delete("/reviews/:reviewId", requireAuth, admin.deleteReview);

router.get("/admin/dashboard", requireAuth, requireRole(ROLES.ADMIN), admin.getDashboard);
router.get("/admin/users", requireAuth, requireRole(ROLES.ADMIN), admin.getAllUsers);
router.patch("/admin/users/:userId/role", requireAuth, requireRole(ROLES.ADMIN), admin.setUserRole);
router.get("/admin/trainers", requireAuth, requireRole(ROLES.ADMIN), admin.getTrainers);
router.get("/admin/settings", requireAuth, requireRole(ROLES.ADMIN), admin.getGymSettings);
router.put("/admin/settings", requireAuth, requireRole(ROLES.ADMIN), admin.updateGymSettings);

router.get("/gym/active-users", requireAuth, requireRole(ROLES.TRAINER, ROLES.ADMIN), trainer.getActiveUsersForTrainer);
router.get("/trainers/:trainerId/last-interaction/:userId", requireAuth, requireRole(ROLES.TRAINER, ROLES.ADMIN), trainer.getLastInteraction);

export default router;