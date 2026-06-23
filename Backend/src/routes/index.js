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
// Bug 35 — CRITICAL: authRateLimiter MUST stay on this route.
// forgotPassword always returns success (to prevent email enumeration), so
// without rate limiting an attacker can probe all emails at full speed.
// If you ever move or rename this route, ensure authRateLimiter travels with it.
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

// ── Users — STATIC segments (/users/me/...) MUST come before dynamic (/users/:id/...)
router.get("/users/me",    cacheResponse(60),                                                                                     userController.getMe);
router.patch("/users/me",  validateSchema(userSchemas.updateProfileSchema),                                                       userController.updateMe);
router.post("/users/me/change-password",        validateSchema(userSchemas.changePasswordSchema),           userController.changePassword);
router.patch("/users/me/notification-preferences", validateSchema(userSchemas.notificationPreferencesSchema), userController.updateNotificationPreferences);
// FIX #33 — self-service account management (any authenticated user can deactivate or delete their own account)
router.patch("/users/me/deactivate",                                                                          userController.deactivateSelf);
router.delete("/users/me",                                                                                    userController.deleteSelf);

// ── Users — dynamic (:id) routes
router.get("/users",       authorize(["ADMIN"]),                                                                                  userController.getUsers);
router.get("/users/:id",   authorize(["ADMIN", "TRAINER"]),                                                                       userController.getUserById);
router.patch("/users/:id/role",       authorize(["ADMIN"]), validateSchema(userSchemas.updateRoleSchema),                         userController.changeRole);
router.patch("/users/:id/deactivate", authorize(["ADMIN"]),                                                                       userController.deactivate);
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
router.get("/progress/stats",                                                                                 progressController.getStats);
router.get("/progress/:id",                                                                                   progressController.getProgressById);
router.patch("/progress/:id",          validateSchema(progressSchemas.updateProgressSchema),                  progressController.updateProgress);
router.delete("/progress/:id",                                                                                progressController.deleteProgress);

// Goals
router.post("/goals",     validateSchema(progressSchemas.goalSchema),   progressController.createGoal);
router.get("/goals",                                                     progressController.getGoals);
router.get("/goals/:id",                                                 progressController.getGoalById);
router.patch("/goals/:id",                                               progressController.updateGoal);
router.delete("/goals/:id",                                              progressController.deleteGoal);

// Routines
router.post("/routines",     validateSchema(progressSchemas.createRoutineSchema), routineController.create);
router.get("/routines",                                                            routineController.getAll);
router.get("/routines/:id",                                                        routineController.getById);
router.patch("/routines/:id", validateSchema(progressSchemas.updateRoutineSchema), routineController.update);
router.delete("/routines/:id",                                                     routineController.remove);

// Routine requests
router.post("/routine-requests",                                                   routineController.requestRoutine);
router.get("/routine-requests",                                                    routineController.getRequests);
router.patch("/routine-requests/:id/accept",  authorize(["TRAINER", "ADMIN"]),    routineController.acceptRequest);
router.patch("/routine-requests/:id/reject",  authorize(["TRAINER", "ADMIN"]),    routineController.rejectRequest);
router.patch("/routine-requests/:id/complete",authorize(["TRAINER", "ADMIN"]),    routineController.completeRequest);

// Rewards
router.get("/rewards",                                                                                        rewardController.getAvailableRewards);
// FIX: /rewards/my-redemptions must be registered BEFORE /rewards/:id to avoid :id matching "my-redemptions"
router.get("/rewards/my-redemptions",                                                                         rewardController.getUserRedemptions);
router.get("/rewards/:id",                                                                                     rewardController.getRewardById);
router.post("/rewards",             authorize(["ADMIN"]), validateSchema(progressSchemas.createRewardSchema), rewardController.createReward);
router.patch("/rewards/:id",        authorize(["ADMIN"]), validateSchema(progressSchemas.updateRewardSchema), rewardController.updateReward);
router.post("/rewards/:id/redeem",                                                                            rewardController.redeemReward);
router.patch("/redemptions/:id/approve", authorize(["ADMIN"]),                                                rewardController.approveRedemption);
router.patch("/redemptions/:id/reject",  authorize(["ADMIN"]),                                                rewardController.rejectRedemption);
router.patch("/redemptions/:id/ship",    authorize(["ADMIN"]),                                                rewardController.ship);
router.patch("/redemptions/:id/deliver", authorize(["ADMIN"]),                                                rewardController.deliver);

// Gamification
router.get("/gamification/points",       gamificationController.getPoints);
router.get("/gamification/achievements", gamificationController.getAchievements);
// FIX #18 — previously unrouted gamification functions
router.get("/gamification/badges",              gamificationController.getBadges);
router.get("/gamification/badges/all",          gamificationController.getAllBadges);
router.post("/gamification/badges/:id/claim",   gamificationController.claimBadge);
router.post("/gamification/review-request",     gamificationController.reviewRequest);

// Challenges
// FIX #20 — static sub-routes (/challenges/active, /challenges/history) BEFORE dynamic (:id)
router.get("/challenges/active",                                                                        challengeController.getActiveChallenges);
router.get("/challenges/history",                                                                       challengeController.getAllChallenges);
router.post("/challenges",              validateSchema(progressSchemas.createChallengeSchema),          challengeController.create);
router.get("/challenges",                                                                               challengeController.getAll);
router.get("/challenges/:id",                                                                           challengeController.getById);
router.patch("/challenges/:id/join",                                                                    challengeController.joinChallenge);
router.patch("/challenges/:id/complete", validateSchema(progressSchemas.completeChallengeSchema),       challengeController.complete);
router.patch("/challenges/:id/cancel",                                                                  challengeController.cancel);

// Assistance
router.post("/assistance",                                                                               assistanceController.request);
router.get("/assistance",              authorize(["TRAINER", "ADMIN"]),                                  assistanceController.getPending);
// FIX: /assistance/my-history is static — must be BEFORE /assistance/:id routes
router.get("/assistance/my-history",                                                                     assistanceController.getHistory);
router.patch("/assistance/:id/assign", authorize(["TRAINER", "ADMIN"]), validateSchema(progressSchemas.assignAssistanceSchema), assistanceController.assign);
router.patch("/assistance/:id/complete", authorize(["TRAINER", "ADMIN"]),                                assistanceController.complete);
router.patch("/assistance/:id/cancel",                                                                   assistanceController.cancel);

// Complaints
router.post("/complaints",              validateSchema(progressSchemas.createComplaintSchema), complaintController.create);
router.get("/complaints",               authorize(["ADMIN"]),                                  complaintController.getAll);
// FIX: /complaints/mine is static — must be BEFORE /complaints/:id
router.get("/complaints/mine",                                                                 complaintController.getMine);
router.get("/complaints/:id",           authorize(["ADMIN"]),                                  complaintController.getById);
router.patch("/complaints/:id/resolve", authorize(["ADMIN"]),                                  complaintController.resolveComplaint);
router.patch("/complaints/:id/reject",  authorize(["ADMIN"]),                                  complaintController.rejectComplaint);

// QR — user & machine
// FIX #9: was qrController.getMyQR (doesn't exist) → corrected to qrController.generateQR
router.get("/qr/my",              qrController.generateQR);
router.post("/qr/validate",       validateSchema(progressSchemas.validateQRSchema), qrController.validateQR);
// FIX #19 — machine management routes (ADMIN only)
router.get("/qr/machines",        authorize(["ADMIN"]),                             qrController.getGymQRCodes);
router.post("/qr/machines",       authorize(["ADMIN"]),                             qrController.createMachine);

// Notifications
// FIX #1: static route /notifications/read-all MUST come before dynamic /notifications/:id/read
// otherwise Express matches id="read-all" and never reaches markAllAsRead
router.get("/notifications",              notificationController.getNotifications);
router.get("/notifications/unread-count", notificationController.getUnreadCount);
router.patch("/notifications/read-all",   notificationController.markAllAsRead);      // ← static first
router.patch("/notifications/:id/read",   notificationController.markAsRead);         // ← dynamic after
router.delete("/notifications/:id",       notificationController.deleteNotification);

// Analytics
router.get("/analytics/me",         analyticsController.getMyAnalytics);
router.get("/analytics/gym",        authorize(["ADMIN"]), analyticsController.getGymAnalytics);
router.get("/analytics/wrapped",    analyticsController.getWrapped);
// FIX #21 — previously unrouted analytics functions
router.get("/analytics/leaderboard",                     analyticsController.getGlobalLeaderboard);
router.get("/analytics/me/rank",                         analyticsController.getUserRank);
router.get("/analytics/engagement", authorize(["ADMIN"]), analyticsController.getEngagementMetrics);

// Admin — Point Review Requests
// FIX #39 — no route existed for admins to list or resolve PointReviewRequests
router.get("/admin/review-requests",          authorize(["ADMIN"]), gamificationController.getReviewRequests);
router.patch("/admin/review-requests/:id/resolve", authorize(["ADMIN"]), gamificationController.resolveReviewRequest);

// Sync (offline action queue)
// FIX #10: was syncController.sync (doesn't exist) → corrected to syncController.syncOfflineActions
// FIX #2: added validateSchema to reject malformed offline action payloads
router.post("/sync", validateSchema(progressSchemas.syncActionsSchema), syncController.syncOfflineActions);

export default router;