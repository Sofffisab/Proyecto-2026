import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";
import { authRateLimiter, apiRateLimiter } from "../middlewares/rateLimiter.js";
import { cacheResponse } from "../middlewares/cache.middleware.js";
import { requireActiveAccount } from "../middlewares/deactivation.middleware.js";
import { runJobs } from "../jobs/index.js";

import * as authController from "../controllers/auth.controller.js";
import * as userController from "../controllers/user.controller.js";
import * as gymController from "../controllers/gym.controller.js";
import * as progressController from "../controllers/progress.controller.js";
import * as routineController from "../controllers/routine.controller.js";
import * as rewardController from "../controllers/reward.controller.js";
import * as gamificationController from "../controllers/gamification.controller.js";
import * as challengeController from "../controllers/challenge.controller.js";
import * as assistanceController from "../controllers/assistance.controller.js";
import * as complaintController from "../controllers/complaint.controller.js";
import * as qrController from "../controllers/qr.controller.js";
import * as notificationController from "../controllers/notification.controller.js";
import * as analyticsController from "../controllers/analytics.controller.js";
import * as syncController from "../controllers/sync.controller.js";
import * as noteController from "../controllers/note.controller.js";

import * as authSchemas from "../validators/auth.schemas.js";
import * as userSchemas from "../validators/user.schemas.js";
import * as progressSchemas from "../validators/progress.schemas.js";
import { validateSchema } from "../validators/schemas.js";

const router = express.Router();

// ============================================
// PUBLIC ROUTES — no authentication required
// ============================================
router.post("/auth/register",        authRateLimiter, validateSchema(authSchemas.registerSchema),       authController.register);
router.post("/auth/login",           authRateLimiter, validateSchema(authSchemas.loginSchema),          authController.login);
router.post("/auth/refresh",         authRateLimiter, validateSchema(authSchemas.refreshTokenSchema),   authController.refreshToken);
router.post("/auth/forgot-password", authRateLimiter, validateSchema(authSchemas.forgotPasswordSchema), authController.forgotPassword);
router.post("/auth/reset-password",  authRateLimiter, validateSchema(authSchemas.resetPasswordSchema),  authController.resetPassword);

// ============================================
// CRON — protected by CRON_SECRET only (no JWT)
// Must be defined BEFORE router.use(authenticate)
// so that Vercel Cron can call it without a user token.
// ============================================
router.get("/cron/jobs", async (req, res, next) => {
  try {
    const secret = req.headers.authorization?.replace("Bearer ", "");
    if (!secret || secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    await runJobs();
    res.json({ success: true, message: "Jobs executed" });
  } catch (err) {
    next(err);
  }
});

// ============================================
// PROTECTED ROUTES — authentication required
// ============================================
router.use(authenticate);
router.use(requireActiveAccount);

// Auth
router.post("/auth/logout", authController.logout);

// Users
router.get("/users/me",    cacheResponse(60),                                                                                     userController.getMe);
router.patch("/users/me",  validateSchema(userSchemas.updateProfileSchema),                                                       userController.updateMe);
router.post("/users/me/change-password", validateSchema(userSchemas.changePasswordSchema),                                        userController.changePassword);
router.get("/users",       authorize(["ADMIN"]),                                                                                  userController.getUsers);
router.get("/users/:id",   authorize(["ADMIN", "TRAINER"]),                                                                       userController.getUserById);
router.patch("/users/:id/role",       authorize(["ADMIN"]), validateSchema(userSchemas.updateRoleSchema),                         userController.changeRole);
router.patch("/users/:id/deactivate", authorize(["ADMIN"]),                                                                       userController.deactivate);
// Uses req.user.id internally — the :id param is ignored in the controller
router.patch("/users/me/notification-preferences", validateSchema(userSchemas.notificationPreferencesSchema),                     userController.updateNotificationPreferences);
router.get("/users/:id/notes",        authorize(["TRAINER", "ADMIN"]),                                                            noteController.getNotes);
router.post("/users/:id/notes",       authorize(["TRAINER"]),                                                                     noteController.createNote);
router.patch("/users/:id/notes/:noteId",  authorize(["TRAINER"]),                                                                 noteController.updateNote);
router.delete("/users/:id/notes/:noteId", authorize(["TRAINER"]),                                                                 noteController.deleteNote);

// Trainers
router.get("/trainers",     userController.getTrainers);
router.get("/trainers/:id", userController.getTrainerById);

// Gym check-in
router.post("/gym/checkin",               apiRateLimiter, validateSchema(userSchemas.gymCheckinSchema), gymController.checkIn);
router.post("/gym/checkout",              apiRateLimiter,                                               gymController.checkOut);
router.get("/gym/sessions",                                                                             gymController.getSessionHistory);
router.get("/gym/sessions/:id",                                                                         gymController.getSessionById);
router.post("/gym/sessions/:id/rate-trainer",                                                           gymController.rateTrainer);
router.get("/gym/present-users",          authorize(["TRAINER", "ADMIN"]),                              gymController.presentUsers);

// Progress
router.post("/progress",               apiRateLimiter, validateSchema(progressSchemas.createProgressSchema), progressController.createProgress);
router.get("/progress",                                                                                       progressController.getProgress);
router.get("/progress/stats/summary",                                                                         progressController.getProgressStats);
router.get("/progress/:id",                                                                                   progressController.getProgressById);
router.patch("/progress/:id",           validateSchema(progressSchemas.updateProgressSchema),                 progressController.updateProgress);
router.delete("/progress/:id",                                                                                progressController.deleteProgress);

// Routines
router.get("/routines/suggestion",           routineController.getSuggestion);
router.post("/routine-requests",             routineController.requestPersonalized);
router.post("/routines",                     validateSchema(progressSchemas.createRoutineSchema),  routineController.createRoutine);
router.get("/routines",                                                                            routineController.getUserRoutines);
router.get("/routines/:id",                                                                        routineController.getRoutineById);
router.patch("/routines/:id",                validateSchema(progressSchemas.updateRoutineSchema),  routineController.updateRoutine);
router.delete("/routines/:id",                                                                     routineController.deleteRoutine);
router.post("/routines/:id/complete-day",    apiRateLimiter,                                       routineController.completeDay);

// Rewards
router.get("/rewards",                       rewardController.getAvailableRewards);
router.get("/rewards/user/redemptions",      rewardController.getUserRedemptions);
router.post("/rewards",                      authorize(["ADMIN", "TRAINER"]), validateSchema(progressSchemas.createRewardSchema),     rewardController.createReward);
router.get("/rewards/:id",                   rewardController.getRewardById);
router.post("/rewards/:id/redeem",           apiRateLimiter,                                                                          rewardController.redeemReward);
router.patch("/rewards/:id",                 authorize(["ADMIN", "TRAINER"]), validateSchema(progressSchemas.updateRewardSchema),      rewardController.updateReward);
router.post("/rewards/:id/approve",          authorize(["ADMIN"]),            validateSchema(progressSchemas.approveRedemptionSchema), rewardController.approveRedemption);
router.post("/rewards/:id/reject",           authorize(["ADMIN"]),            validateSchema(progressSchemas.rejectRedemptionSchema),  rewardController.rejectRedemption);
router.patch("/rewards/redemptions/:id/ship",    authorize(["ADMIN"]),                                                                rewardController.ship);
router.patch("/rewards/redemptions/:id/deliver", authorize(["ADMIN"]),                                                                rewardController.deliver);

// Gamification
router.get("/gamification/points",             cacheResponse(30), gamificationController.getPoints);
router.get("/gamification/badges",                                gamificationController.getBadges);
router.get("/gamification/badges/all",                            gamificationController.getAllBadges);
router.post("/gamification/badges/:id/claim",  apiRateLimiter,   gamificationController.claimBadge);
router.get("/gamification/achievements",                          gamificationController.getAchievements);
router.get("/gamification/wrapped",                               gamificationController.getWrapped);

// Challenges & Social
router.post("/challenges",              authorize(["TRAINER", "ADMIN"]), validateSchema(progressSchemas.createChallengeSchema),  challengeController.createChallenge);
router.get("/challenges/active",                                                                                                  challengeController.getActiveChallenges);
router.get("/challenges",                                                                                                         challengeController.getAllChallenges);
router.get("/challenges/:id",                                                                                                     challengeController.getChallengeById);
router.post("/challenges/:id/join",     apiRateLimiter,                                                                           challengeController.joinChallenge);
router.post("/challenges/:id/complete", apiRateLimiter, validateSchema(progressSchemas.completeChallengeSchema),                  challengeController.completeChallenge);
router.post("/challenges/:id/cancel",   authorize(["TRAINER", "ADMIN"]), validateSchema(progressSchemas.cancelChallengeSchema),   challengeController.cancelChallenge);
router.get("/challenges/:id/leaderboard",                                                                                         challengeController.getChallengeLeaderboard);
router.get("/social/challenge/active",                                                                                            challengeController.getActive);
router.get("/social/history",                                                                                                     challengeController.getHistory);

// Assistance
router.post("/assistance/request",      apiRateLimiter, validateSchema(progressSchemas.requestAssistanceSchema), assistanceController.requestAssistance);
router.get("/assistance/requests",      authorize(["TRAINER", "ADMIN"]),                                         assistanceController.getAssistanceRequests);
router.get("/assistance/my-requests",                                                                             assistanceController.getUserAssistanceRequests);
// trainerId is forced to req.user.id in the controller — a trainer can only assign themselves
router.post("/assistance/:id/assign",   authorize(["TRAINER"]), validateSchema(progressSchemas.assignAssistanceSchema),   assistanceController.assignAssistance);
// Only TRAINER or ADMIN can mark an assistance as complete
router.post("/assistance/:id/complete", authorize(["TRAINER", "ADMIN"]), validateSchema(progressSchemas.completeAssistanceSchema), assistanceController.completeAssistance);
router.post("/assistance/:id/cancel",                                                                                      assistanceController.cancelAssistance);

// Complaints
router.post("/complaints",         apiRateLimiter, validateSchema(progressSchemas.createComplaintSchema),          complaintController.createComplaint);
router.get("/complaints/user",                                                                                      complaintController.getUserComplaints);
router.get("/complaints",          authorize(["ADMIN"]),                                                           complaintController.getAllComplaints);
router.get("/complaints/:id",                                                                                       complaintController.getComplaintById);
router.post("/complaints/:id/resolve", authorize(["ADMIN"]), validateSchema(progressSchemas.resolveComplaintSchema), complaintController.resolveComplaint);
router.post("/complaints/:id/reject",  authorize(["ADMIN"]), validateSchema(progressSchemas.rejectComplaintSchema),  complaintController.rejectComplaint);

// QR
router.post("/qr/generate",    authorize(["TRAINER", "ADMIN"]), validateSchema(progressSchemas.generateQRSchema), qrController.generateQR);
router.post("/qr/validate",    apiRateLimiter,                  validateSchema(progressSchemas.validateQRSchema), qrController.validateQR);
router.get("/qr/gym/:gymId",   authorize(["TRAINER", "ADMIN"]),                                                   qrController.getGymQRCodes);
router.post("/qr/machines",    authorize(["ADMIN", "TRAINER"]),                                                    qrController.createMachine);

// Sync
router.post("/sync", syncController.syncOfflineActions);

// Notifications
router.get("/notifications",              notificationController.getNotifications);
router.patch("/notifications/read-all",   notificationController.markAllAsRead);
router.get("/notifications/unread/count", notificationController.getUnreadCount);
router.patch("/notifications/:id/read",   notificationController.markAsRead);
router.delete("/notifications/:id",       notificationController.deleteNotification);

// Analytics
router.get("/analytics/me",          cacheResponse(120),             analyticsController.getUserAnalytics);
router.get("/analytics/gym",         authorize(["ADMIN", "TRAINER"]), analyticsController.getGymAnalytics);
router.get("/analytics/leaderboard",                                  analyticsController.getGlobalLeaderboard);
router.get("/analytics/rank",                                         analyticsController.getUserRank);
router.get("/analytics/engagement",  authorize(["ADMIN"]),            analyticsController.getEngagementMetrics);

export default router;