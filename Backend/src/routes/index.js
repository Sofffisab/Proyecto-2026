import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";
import { requireCompleteProfile } from "../middlewares/profileCompletion.middleware.js";
import { authRateLimiter, apiRateLimiter } from "../middlewares/rateLimiter.js";
import { cacheResponse } from "../middlewares/cache.middleware.js";
import { runJobs } from "../jobs/index.js";
import { rotateMachineQRCodes } from "../jobs/qr.job.js";

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
import * as machineConflictController from "../controllers/machineConflict.controller.js";
import * as notificationController from "../controllers/notification.controller.js";
import * as analyticsController    from "../controllers/analytics.controller.js";
import * as syncController         from "../controllers/sync.controller.js";
import * as noteController         from "../controllers/note.controller.js";

import { validateSchema } from "../validators/schemas.js";
import * as authSchemas     from "../validators/auth.schemas.js";
import * as userSchemas     from "../validators/user.schemas.js";
import * as progressSchemas from "../validators/progress.schemas.js";
import * as challengeSchemas from "../validators/challenge.schemas.js";

const router = express.Router();

// CRON / JOB TRIGGER ROUTE
// Vercel Cron Jobs invoke the configured path with GET (see vercel.json);
// POST is also kept so the job can still be triggered manually/for testing.
const cronAuth = (req, res, next) => {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  next();
};
router.get("/cron/jobs", cronAuth, runJobs);
router.post("/cron/jobs", cronAuth, runJobs);

// Separate cron trigger because it runs on its own schedule (noon) instead
// of the main nightly job batch — see vercel.json "crons".
const qrRotateHandler = async (req, res, next) => {
  try {
    await rotateMachineQRCodes();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
router.get("/cron/qr-rotate", cronAuth, qrRotateHandler);
router.post("/cron/qr-rotate", cronAuth, qrRotateHandler);

// PUBLIC / AUTH ROUTES
router.post("/auth/register",        authRateLimiter, validateSchema(authSchemas.registerSchema), authController.register);
router.post("/auth/login",           authRateLimiter, validateSchema(authSchemas.loginSchema), authController.login);
router.post("/auth/refresh-token",   validateSchema(authSchemas.refreshTokenSchema), authController.refreshToken);
router.post("/auth/forgot-password", authRateLimiter, validateSchema(authSchemas.forgotPasswordSchema), authController.forgotPassword);
router.post("/auth/reset-password",  authRateLimiter, validateSchema(authSchemas.resetPasswordSchema), authController.resetPassword);

// Scoped (not blanket) so unmatched routes still fall through to the 404
// handler instead of a 401 here. Matches routes registered below.
const PROTECTED_PREFIXES = [
  "/auth", "/users", "/user", "/gym", "/progress", "/goals", "/routines", "/rewards",
  "/gamification", "/challenges", "/assistance", "/complaints", "/qr",
  "/notifications", "/analytics", "/sync", "/notes", "/trainers", "/admin",
];
router.use(PROTECTED_PREFIXES, authenticate);
// Blocks members from the rest of the API until required profile data is
// filled in. Runs after authenticate; exempt paths are whitelisted inside.
router.use(PROTECTED_PREFIXES, requireCompleteProfile);
router.use(PROTECTED_PREFIXES, apiRateLimiter);

router.post("/auth/logout", authController.logout);
router.post("/auth/users",  authorize(["ADMIN"]), validateSchema(authSchemas.createUserByAdminSchema), authController.createUserByAdmin);

// USERS ROUTES
router.get("/users/me",             userController.getMe);
// Authenticated alias for /users/me
router.get("/user/profile",         userController.getMe);
router.put("/users/me",             validateSchema(userSchemas.updateProfileSchema), userController.updateMe);
router.patch("/users/me/password",  validateSchema(userSchemas.changePasswordSchema), userController.changePassword);
router.patch("/users/me/settings",  validateSchema(userSchemas.updateSettingsSchema), userController.updateNotificationPreferences);
router.patch("/users/me/fcm-token", validateSchema(userSchemas.fcmTokenSchema), userController.updateFcmToken);
router.delete("/users/me",          userController.deactivateSelf);

router.get("/users",                authorize(["ADMIN", "TRAINER"]), userController.getUsers);
router.get("/users/:id",            authorize(["ADMIN", "TRAINER"]), userController.getUserById);
router.patch("/users/:id/role",     authorize(["ADMIN"]), validateSchema(userSchemas.updateRoleSchema), userController.changeRole);
router.patch("/users/:id/status",   authorize(["ADMIN"]), validateSchema(userSchemas.deactivateUserSchema), userController.deactivate);
router.post("/users/:id/trainer-profile", authorize(["ADMIN", "TRAINER"]), validateSchema(userSchemas.trainerProfileSchema), userController.upsertTrainerProfile);

// TRAINER ROUTES
router.get("/trainers",             userController.getTrainers);
router.get("/trainers/:id",         userController.getTrainerById);

// GYM ACCESS ROUTES
router.get("/gym/status",           gymController.getGymStatus);
router.post("/gym/checkin",         gymController.checkIn);
router.post("/gym/checkout",        gymController.checkOut);
router.get("/gym/occupancy/live",   cacheResponse(60), gymController.presentUsers);
router.get("/gym/priority-assistance", authorize(["TRAINER", "ADMIN"]), gymController.priorityAssistanceList);
router.get("/gym/sessions",         gymController.getSessionHistory);
router.get("/gym/sessions/:id",     gymController.getSessionById);
router.post("/gym/sessions/:id/rate", validateSchema(progressSchemas.rateTrainerSchema), gymController.rateTrainer);

// PROGRESS & GOALS ROUTES
router.post("/goals",               validateSchema(progressSchemas.goalSchema), progressController.createGoal);
router.get("/goals",                progressController.getGoals);
router.post("/progress",            validateSchema(progressSchemas.createProgressSchema), progressController.addProgressLog);
router.get("/progress/history",     progressController.getProgressHistory);
router.put("/progress/:id",         validateSchema(progressSchemas.updateProgressSchema), progressController.updateProgressLog);

// ROUTINES ROUTES
router.post("/routines",                    validateSchema(progressSchemas.createRoutineSchema), routineController.create);
router.get("/routines",                     routineController.getAll);
router.get("/routines/suggestion",          routineController.getSuggestion);
router.get("/routines/today",               routineController.getToday);
router.get("/routines/suggestions/patterns",  routineController.getPatternSuggestion);
router.post("/routines/suggestions/accept",   validateSchema(progressSchemas.acceptRoutineSuggestionSchema), routineController.acceptPatternSuggestion);
router.post("/routines/suggestions/reject",   routineController.rejectPatternSuggestion);
router.get("/routines/:id",                 routineController.getById);
router.put("/routines/:id",                 validateSchema(progressSchemas.updateRoutineSchema), routineController.update);
router.delete("/routines/:id",              routineController.remove);

router.post("/routines/requests",           validateSchema(userSchemas.requestRoutineSchema), routineController.requestRoutine);
router.get("/routines/requests/all",        routineController.getRequests);
router.patch("/routines/requests/:id/accept", routineController.acceptRequest);
router.patch("/routines/requests/:id/reject", routineController.rejectRequest);
router.patch("/routines/requests/:id/complete", routineController.completeRequest);
router.patch("/routines/:id/day/:dayIndex", routineController.completeDay);

// REWARDS ROUTES
// No catalog / no user choice: rewards are granted automatically by point
// threshold (see reward.service.js#autoGrantRewards) and shipped by the gym.
router.get("/rewards",                      rewardController.getAvailableRewards);
router.get("/rewards/redemptions/me",       rewardController.getUserRedemptions);
router.get("/rewards/redemptions",          authorize(["ADMIN"]), rewardController.getAllRedemptions);
router.patch("/rewards/redemptions/:id",    authorize(["ADMIN"]), rewardController.updateRedemptionStatus);
// People who qualified by points but had nothing in stock; auto-resolved on
// restock (reward.service.js#fulfillPendingGrants). Lets admins see the backlog.
router.get("/rewards/pending",              authorize(["ADMIN"]), rewardController.getPendingGrants);

// Admin-only catalog management: includes stock and isMarketingItem, never
// exposed on the public GET /rewards above.
router.get("/rewards/admin",                authorize(["ADMIN"]), rewardController.getAllRewardsAdmin);
router.post("/rewards",                     authorize(["ADMIN"]), validateSchema(progressSchemas.createRewardSchema), rewardController.createReward);
router.patch("/rewards/:id",                authorize(["ADMIN"]), validateSchema(progressSchemas.updateRewardSchema), rewardController.updateReward);
router.get("/rewards/:id",                  authorize(["ADMIN"]), rewardController.getRewardById);

// GAMIFICATION ROUTES
router.get("/gamification/points", gamificationController.getUserPoints);
router.get("/gamification/badges",          gamificationController.getUserBadges);
// Badges (above) auto-unlock from activity (see gamification.service.js).
// No manual claim, catalog, or leaderboard route — by design.
router.post("/gamification/review-request", validateSchema(progressSchemas.pointReviewRequestSchema), gamificationController.createReviewRequest);

// CHALLENGES ROUTES
// Challenges are never created from a form: auto-assigned by the scheduled
// job, or paired instantly via QR exchange (scan-user, below).
router.get("/challenges",                   challengeController.getAll);
router.get("/challenges/active",            challengeController.getActive);
// Instant pairing via QR exchange — no form/searcher. See scanUser controller.
router.post("/challenges/scan-user",        validateSchema(challengeSchemas.scanUserChallengeSchema), challengeController.scanUser);
router.get("/challenges/:id",               challengeController.getById);
router.patch("/challenges/:id/join",        challengeController.joinChallenge);
router.patch("/challenges/:id/complete",    validateSchema(challengeSchemas.completeChallengeSchema), challengeController.complete);
router.patch("/challenges/:id/cancel",      challengeController.cancel);
// No per-challenge leaderboard route — no rankings anywhere in the product.

// ASSISTANCE ROUTES
router.post("/assistance/request",          assistanceController.request);
router.get("/assistance/active",            assistanceController.getPending);
router.patch("/assistance/:id/assign",      authorize(["TRAINER", "ADMIN"]), assistanceController.assign);
router.patch("/assistance/:id/complete",    assistanceController.complete);
router.patch("/assistance/:id/cancel",      assistanceController.cancel);
router.patch("/assistance/trainer/availability", authorize(["TRAINER", "ADMIN"]), assistanceController.setAvailability);

// COMPLAINTS ROUTES
router.post("/complaints",                  validateSchema(progressSchemas.createComplaintSchema), complaintController.createComplaint);
// Trainer -> member reports (equipment damage, misconduct, etc.), separate
// from the generic member-to-member complaint above.
router.post("/complaints/trainer",          authorize(["TRAINER", "ADMIN"]), validateSchema(progressSchemas.createTrainerComplaintSchema), complaintController.createTrainerComplaint);
router.get("/complaints/me",                complaintController.getMyComplaints);
router.get("/complaints",                   authorize(["ADMIN"]), complaintController.getAdminComplaints);
router.patch("/complaints/:id/resolve",     authorize(["ADMIN"]), validateSchema(progressSchemas.resolveComplaintSchema), complaintController.resolveComplaint);
router.patch("/complaints/:id/reject",      authorize(["ADMIN"]), validateSchema(progressSchemas.rejectComplaintSchema), complaintController.rejectComplaint);

// QR MANAGEMENT ROUTES
router.get("/qr/me",      qrController.generateQR);
router.post("/qr/scan",   validateSchema(progressSchemas.validateQRSchema), qrController.validateQR);
router.get("/qr/gym-access", authorize(["ADMIN"]), qrController.getGymQRCodes);
router.post("/qr/machines",  authorize(["ADMIN"]), validateSchema(progressSchemas.createMachineSchema), qrController.createMachine);
router.patch("/qr/machines/:id/regenerate", authorize(["ADMIN", "TRAINER"]), qrController.regenerateMachine);
router.delete("/qr/machines/:id",           authorize(["ADMIN"]), qrController.deactivateMachine);

// Machine conflicts (two people on the same machine): trainer-facing verification queue.
router.get("/qr/machine-conflicts",             authorize(["TRAINER", "ADMIN"]), machineConflictController.getPendingConflicts);
router.patch("/qr/machine-conflicts/:id/resolve", authorize(["TRAINER", "ADMIN"]), validateSchema(progressSchemas.resolveMachineConflictSchema), machineConflictController.resolveConflict);

// NOTIFICATIONS ROUTES
router.get("/notifications",               notificationController.getNotifications);
router.get("/notifications/unread-count",  notificationController.getUnreadCount);
router.patch("/notifications/read-all",    notificationController.markAllAsRead);
router.patch("/notifications/:id/read",    notificationController.markAsRead);
router.delete("/notifications/:id",        notificationController.deleteNotification);

// ANALYTICS ROUTES
router.get("/analytics/me",          analyticsController.getUserAnalytics);
router.get("/analytics/gym",         authorize(["ADMIN"]), analyticsController.getGymAnalytics);
router.get("/analytics/wrapped",     gamificationController.getWrapped);
// No global leaderboard or personal-rank route — no rankings, public or private.
router.get("/analytics/patterns",    analyticsController.getUserPatterns);
router.get("/analytics/engagement",  authorize(["ADMIN"]), analyticsController.getEngagementMetrics);
// Full cross-user history/analytics export, run through the privacy/
// pseudonymization layer — see insights.service.js#getFullHistoryAdmin.
router.get("/analytics/admin/history", authorize(["ADMIN"]), analyticsController.getFullHistoryAdmin);

// TRAINER NOTES ROUTES
router.get("/users/:id/notes",             authorize(["TRAINER", "ADMIN"]), noteController.getNotes);
router.post("/users/:id/notes",            authorize(["TRAINER", "ADMIN"]), validateSchema(userSchemas.createNoteSchema), noteController.createNote);
router.put("/users/:id/notes/:noteId",     authorize(["TRAINER", "ADMIN"]), validateSchema(userSchemas.createNoteSchema), noteController.updateNote);
router.delete("/users/:id/notes/:noteId",  authorize(["TRAINER", "ADMIN"]), noteController.deleteNote);

// ADMINISTRATIVE REVIEW REQUESTS
router.get("/admin/review-requests",               authorize(["ADMIN"]), gamificationController.getReviewRequests);
router.patch("/admin/review-requests/:id/resolve", authorize(["ADMIN"]), gamificationController.resolveReviewRequest);

// OFFLINE SYNC ROUTE
router.post("/sync", validateSchema(progressSchemas.syncActionsSchema), syncController.syncOfflineActions);

export default router;