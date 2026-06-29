import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";
import { authRateLimiter, apiRateLimiter } from "../middlewares/rateLimiter.js";
import { cacheResponse } from "../middlewares/cache.middleware.js";
import { runJobs } from "../jobs/index.js";

import * as authController         from "../controllers/auth.controller.js";
import * as userController         from "../controllers/user.controller.js";
import * as gymController          from "../controllers/gym.controller.js";
import * as progressController     from "../controllers/progress.controller.js";
import * as routineController      from "../controllers/routine.controller.js";
import * as rewardController       from "../controllers/reward.controller.js";
import * as gamificationController from "../controllers/gamification.controller.js";
import * as challengeController    from "../controllers/challenge.controller.js";
import * as assistanceController   from "../controllers/assistance.controller.js";
import * as complaintController    from "../controllers/complaint.controller.js";
import * as qrController           from "../controllers/qr.controller.js";
import * as notificationController from "../controllers/notification.controller.js";
import * as analyticsController    from "../controllers/analytics.controller.js";
import * as syncController         from "../controllers/sync.controller.js";

import { validateSchema } from "../validators/schemas.js";
import * as authSchemas from "../validators/auth.schemas.js";
import * as userSchemas from "../validators/user.schemas.js";
import * as progressSchemas from "../validators/progress.schemas.js";
import * as challengeSchemas from "../validators/challenge.schemas.js";

const router = express.Router();

// ── CRON / JOB TRIGGER ROUTE ──────────────────────────────────────────────────
router.post("/cron/jobs", runJobs);

// ── PUBLIC / AUTH ROUTES ──────────────────────────────────────────────────────
router.post("/auth/register",        authRateLimiter, validateSchema(authSchemas.registerSchema), authController.register);
router.post("/auth/login",           authRateLimiter, validateSchema(authSchemas.loginSchema), authController.login);
router.post("/auth/refresh-token",   validateSchema(authSchemas.refreshTokenSchema), authController.refreshToken);
router.post("/auth/forgot-password", authRateLimiter, validateSchema(authSchemas.forgotPasswordSchema), authController.forgotPassword);
router.post("/auth/reset-password",  authRateLimiter, validateSchema(authSchemas.resetPasswordSchema), authController.resetPassword);

router.use(authenticate);
router.use(apiRateLimiter);

// ── USERS ROUTES ──────────────────────────────────────────────────────────────
router.get("/users/me",             userController.getProfile);
router.put("/users/me",             validateSchema(userSchemas.updateProfileSchema), userController.updateProfile);
router.patch("/users/me/password",  validateSchema(userSchemas.changePasswordSchema), userController.changePassword);
router.patch("/users/me/settings",  validateSchema(userSchemas.updateSettingsSchema), userController.updateSettings);
router.delete("/users/me",          userController.deactivateMe);

router.get("/users",                authorize(["ADMIN", "TRAINER"]), userController.getAllUsers);
router.get("/users/:id",            authorize(["ADMIN", "TRAINER"]), userController.getUserById);
router.patch("/users/:id/role",     authorize(["ADMIN"]), validateSchema(userSchemas.updateRoleSchema), userController.updateUserRole);
router.patch("/users/:id/status",   authorize(["ADMIN"]), validateSchema(userSchemas.deactivateUserSchema), userController.toggleUserStatus);
router.post("/users/:id/trainer-profile", authorize(["ADMIN", "TRAINER"]), validateSchema(userSchemas.trainerProfileSchema), userController.upsertTrainerProfile);

// ── GYM ACCESS ROUTES ─────────────────────────────────────────────────────────
router.get("/gym/status",           gymController.getGymStatus);
router.post("/gym/checkin",         gymController.checkInUser);
router.post("/gym/checkout",        gymController.checkOutUser);
router.get("/gym/occupancy/live",   cacheResponse(60), gymController.getLiveOccupancy);

// ── PROGRESS & GOALS ROUTES ───────────────────────────────────────────────────
router.post("/goals",               validateSchema(progressSchemas.goalSchema), progressController.createGoal);
router.get("/goals",                progressController.getGoals);
router.post("/progress",            validateSchema(progressSchemas.createProgressSchema), progressController.addProgressLog);
router.get("/progress/history",     progressController.getProgressHistory);
router.put("/progress/:id",         validateSchema(progressSchemas.updateProgressSchema), progressController.updateProgressLog);

// ── ROUTINES ROUTES ───────────────────────────────────────────────────────────
router.post("/routines",                    validateSchema(progressSchemas.createRoutineSchema), routineController.create);
router.get("/routines",                     routineController.getAll);
router.get("/routines/suggestion",          routineController.getSuggestion); 
router.get("/routines/:id",                 routineController.getById);
router.put("/routines/:id",                 validateSchema(progressSchemas.updateRoutineSchema), routineController.update);
router.delete("/routines/:id",              routineController.remove);

router.post("/routines/requests",           validateSchema(progressSchemas.requestRoutineSchema), routineController.requestRoutine);
router.get("/routines/requests/all",        routineController.getRequests);
router.patch("/routines/requests/:id/accept", routineController.acceptRequest);
router.patch("/routines/requests/:id/reject", routineController.rejectRequest);
router.patch("/routines/requests/:id/complete", routineController.completeRequest);
router.patch("/routines/:id/day/:dayIndex", routineController.completeDay);

// ── REWARDS ROUTES ────────────────────────────────────────────────────────────
router.get("/rewards",                      rewardController.getAvailableRewards);
router.post("/rewards/:id/redeem",          rewardController.redeemReward);
router.get("/rewards/redemptions/me",       rewardController.getMyRedemptions);
router.get("/rewards/redemptions",          authorize(["ADMIN"]), rewardController.getAllRedemptions);
router.patch("/rewards/redemptions/:id",    authorize(["ADMIN"]), rewardController.updateRedemptionStatus);

// ── GAMIFICATION ROUTES ───────────────────────────────────────────────────────
router.get("/gamification/streaks",         gamificationController.getUserStreaks);
router.get("/gamification/badges",          gamificationController.getUserBadges);
router.get("/gamification/levels",          gamificationController.getLevelConfig);
router.post("/gamification/review-request", validateSchema(progressSchemas.reviewRequestSchema), gamificationController.createReviewRequest);

// ── CHALLENGES ROUTES ─────────────────────────────────────────────────────────
router.post("/challenges",                  validateSchema(challengeSchemas.createChallengeSchema), challengeController.create);
router.get("/challenges",                   challengeController.getAll);
router.get("/challenges/active",            challengeController.getActive);
router.get("/challenges/:id",               challengeController.getById);
router.patch("/challenges/:id/join",        challengeController.joinChallenge);
router.patch("/challenges/:id/complete",    validateSchema(challengeSchemas.completeChallengeSchema), challengeController.complete);
router.patch("/challenges/:id/cancel",      challengeController.cancel);
router.get("/challenges/:id/leaderboard",   challengeController.getChallengeLeaderboard);

// ── ASSISTANCE ROUTES ─────────────────────────────────────────────────────────
router.post("/assistance/request",          assistanceController.requestAssistance);
router.get("/assistance/active",            assistanceController.getActiveRequests);
router.patch("/assistance/:id/assign",      authorize(["TRAINER", "ADMIN"]), assistanceController.assignTrainer);
router.patch("/assistance/:id/complete",    assistanceController.completeRequest);
router.patch("/assistance/:id/cancel",      assistanceController.cancelRequest);

// ── COMPLAINTS ROUTES ─────────────────────────────────────────────────────────
router.post("/complaints",                  validateSchema(progressSchemas.complaintSchema), complaintController.createComplaint);
router.get("/complaints/me",                complaintController.getMyComplaints);
router.get("/complaints",                   authorize(["ADMIN"]), complaintController.getAdminComplaints);
router.patch("/complaints/:id/resolve",     authorize(["ADMIN"]), validateSchema(progressSchemas.resolveComplaintSchema), complaintController.resolveComplaint);

// ── QR MANAGEMENT ROUTES ──────────────────────────────────────────────────────
router.get("/qr/gym-access", qrController.getGymQRCodes);
router.post("/qr/machines",  authorize(["ADMIN"]), validateSchema(progressSchemas.createMachineSchema), qrController.createMachine);

// ── NOTIFICATIONS ROUTES ──────────────────────────────────────────────────────
router.get("/notifications",               notificationController.getNotifications);
router.get("/notifications/unread-count",  notificationController.getUnreadCount);
router.patch("/notifications/read-all",    notificationController.markAllAsRead);
router.patch("/notifications/:id/read",    notificationController.markAsRead);
router.delete("/notifications/:id",        notificationController.deleteNotification);

// ── ANALYTICS ROUTES ──────────────────────────────────────────────────────────
router.get("/analytics/me",          analyticsController.getUserAnalytics);
router.get("/analytics/gym",         authorize(["ADMIN"]), analyticsController.getGymAnalytics);
router.get("/analytics/wrapped",     gamificationController.getWrapped);
router.get("/analytics/leaderboard", analyticsController.getGlobalLeaderboard);
router.get("/analytics/me/rank",     analyticsController.getUserRank);
router.get("/analytics/engagement",  authorize(["ADMIN"]), analyticsController.getEngagementMetrics);

// ── ADMINISTRATIVE REVIEW REQUESTS ────────────────────────────────────────────
router.get("/admin/review-requests",               authorize(["ADMIN"]), gamificationController.getReviewRequests);
router.patch("/admin/review-requests/:id/resolve", authorize(["ADMIN"]), gamificationController.resolveReviewRequest);

// ── OFFLINE SYNC ROUTE ────────────────────────────────────────────────────────
router.post("/sync", validateSchema(progressSchemas.syncActionsSchema), syncController.syncOfflineActions);

export default router;