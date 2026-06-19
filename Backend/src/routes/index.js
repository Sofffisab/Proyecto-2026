import express from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';
import { apiRateLimiter } from '../middlewares/rateLimiter.js';
import { validateSchema } from '../validators/schemas.js';

// Controllers
import * as authController from '../controllers/auth.controller.js';
import * as userController from '../controllers/user.controller.js';
import * as gymController from '../controllers/gym.controller.js';
import * as progressController from '../controllers/progress.controller.js';
import * as routineController from '../controllers/routine.controller.js';
import * as rewardController from '../controllers/reward.controller.js';
import * as gamificationController from '../controllers/gamification.controller.js';
import * as challengeController from '../controllers/challenge.controller.js';
import * as assistanceController from '../controllers/assistance.controller.js';
import * as complaintController from '../controllers/complaint.controller.js';
import * as qrController from '../controllers/qr.controller.js';
import * as notificationController from '../controllers/notification.controller.js';
import * as analyticsController from '../controllers/analytics.controller.js';
import * as syncController from '../controllers/sync.controller.js';
import { requireActiveAccount } from '../middlewares/deactivation.middleware.js';

// Schemas
import * as authSchemas from '../validators/auth.schemas.js';
import * as userSchemas from '../validators/user.schemas.js';
import * as progressSchemas from '../validators/progress.schemas.js';

const router = express.Router();

router.use(authenticate);
router.use(requireActiveAccount);

// ============================================
// AUTH ROUTES
// ============================================
router.post('/auth/register', apiRateLimiter, validateSchema(authSchemas.registerSchema), authController.register);
router.post('/auth/login', apiRateLimiter, validateSchema(authSchemas.loginSchema), authController.login);
router.post('/auth/refresh', apiRateLimiter, validateSchema(authSchemas.refreshTokenSchema), authController.refreshToken);
router.post('/auth/logout', authenticate, authController.logout);
router.post('/auth/forgot-password', apiRateLimiter, validateSchema(authSchemas.forgotPasswordSchema), authController.forgotPassword);
router.post('/auth/reset-password', apiRateLimiter, validateSchema(authSchemas.resetPasswordSchema), authController.resetPassword);

// ============================================
// USER ROUTES
// ============================================
router.get('/users/me', authenticate, userController.getMe);
router.patch('/users/me', authenticate, validateSchema(userSchemas.updateProfileSchema), userController.updateMe);
router.post('/users/me/change-password', authenticate, validateSchema(userSchemas.changePasswordSchema), userController.changePassword);
router.get('/users', authenticate, authorize(['ADMIN']), userController.getUsers);
router.get('/users/:id', authenticate, authorize(['ADMIN', 'TRAINER']), userController.getUserById);
router.patch('/users/:id/role', authenticate, authorize(['ADMIN']), validateSchema(userSchemas.updateRoleSchema), userController.changeRole);
router.patch('/users/:id/deactivate', authenticate, authorize(['ADMIN']), userController.deactivate);
router.patch('/users/:id/notification-preferences', authenticate, validateSchema(userSchemas.notificationPreferencesSchema), userController.updateNotificationPreferences);

// ============================================
// GYM CHECK-IN ROUTES
// ============================================
router.post('/gym/checkin', authenticate, apiRateLimiter, validateSchema(userSchemas.gymCheckinSchema), gymController.checkIn);
router.post('/gym/checkout', authenticate, apiRateLimiter, gymController.checkOut);
router.get('/gym/sessions', authenticate, gymController.getSessionHistory);
router.get('/gym/sessions/:id', authenticate, gymController.getSessionById);

// ============================================
// PROGRESS ROUTES
// ============================================
router.post('/progress', authenticate, apiRateLimiter, validateSchema(progressSchemas.createProgressSchema), progressController.createProgress);
router.get('/progress', authenticate, progressController.getProgress);
router.get('/progress/:id', authenticate, progressController.getProgressById);
router.patch('/progress/:id', authenticate, validateSchema(progressSchemas.updateProgressSchema), progressController.updateProgress);
router.delete('/progress/:id', authenticate, progressController.deleteProgress);
router.get('/progress/stats/summary', authenticate, progressController.getProgressStats);

// ============================================
// ROUTINE ROUTES
// ============================================
router.post('/routines', authenticate, validateSchema(progressSchemas.createRoutineSchema), routineController.createRoutine);
router.get('/routines', authenticate, routineController.getUserRoutines);
router.get('/routines/:id', authenticate, routineController.getRoutineById);
router.patch('/routines/:id', authenticate, validateSchema(progressSchemas.updateRoutineSchema), routineController.updateRoutine);
router.delete('/routines/:id', authenticate, routineController.deleteRoutine);
router.post('/routines/:id/complete-day', authenticate, apiRateLimiter, routineController.completeDay);

// ============================================
// REWARDS ROUTES
// ============================================
router.get('/rewards', authenticate, rewardController.getAvailableRewards);
router.get('/rewards/user/redemptions', authenticate, rewardController.getUserRedemptions);
router.get('/rewards/:id', authenticate, rewardController.getRewardById);
router.post('/rewards/:id/redeem', authenticate, apiRateLimiter, rewardController.redeemReward);
router.post('/rewards', authenticate, authorize(['ADMIN', 'TRAINER']), validateSchema(progressSchemas.createRewardSchema), rewardController.createReward);
router.patch('/rewards/:id', authenticate, authorize(['ADMIN', 'TRAINER']), validateSchema(progressSchemas.updateRewardSchema), rewardController.updateReward);
router.post('/rewards/:id/approve', authenticate, authorize(['ADMIN']), validateSchema(progressSchemas.approveRedemptionSchema), rewardController.approveRedemption);
router.post('/rewards/:id/reject', authenticate, authorize(['ADMIN']), validateSchema(progressSchemas.rejectRedemptionSchema), rewardController.rejectRedemption);

// ============================================
// GAMIFICATION ROUTES
// ============================================
router.get('/gamification/points', authenticate, gamificationController.getPoints);
router.get('/gamification/badges', authenticate, gamificationController.getBadges);
router.get('/gamification/badges/all', authenticate, gamificationController.getAllBadges);
router.post('/gamification/badges/:id/claim', authenticate, apiRateLimiter, gamificationController.claimBadge);
router.get('/gamification/achievements', authenticate, gamificationController.getAchievements);
router.get('/gamification/wrapped', authenticate, gamificationController.getWrapped);

// ============================================
// CHALLENGES ROUTES
// ============================================
router.post('/challenges', authenticate, authorize(['TRAINER', 'ADMIN']), validateSchema(progressSchemas.createChallengeSchema), challengeController.createChallenge);
router.get('/challenges/active', authenticate, challengeController.getActiveChallenges);
router.get('/challenges', authenticate, challengeController.getAllChallenges);
router.get('/challenges/:id', authenticate, challengeController.getChallengeById);
router.post('/challenges/:id/join', authenticate, apiRateLimiter, challengeController.joinChallenge);
router.post('/challenges/:id/complete', authenticate, apiRateLimiter, validateSchema(progressSchemas.completeChallengeSchema), challengeController.completeChallenge);
router.post('/challenges/:id/cancel', authenticate, authorize(['TRAINER', 'ADMIN']), validateSchema(progressSchemas.cancelChallengeSchema), challengeController.cancelChallenge);
router.get('/challenges/:id/leaderboard', authenticate, challengeController.getChallengeLeaderboard);

// ============================================
// ASSISTANCE ROUTES
// ============================================
router.post('/assistance/request', authenticate, apiRateLimiter, validateSchema(progressSchemas.requestAssistanceSchema), assistanceController.requestAssistance);
router.get('/assistance/requests', authenticate, authorize(['TRAINER', 'ADMIN']), assistanceController.getAssistanceRequests);
router.get('/assistance/my-requests', authenticate, assistanceController.getUserAssistanceRequests);
router.post('/assistance/:id/assign', authenticate, authorize(['TRAINER']), validateSchema(progressSchemas.assignAssistanceSchema), assistanceController.assignAssistance);
router.post('/assistance/:id/complete', authenticate, validateSchema(progressSchemas.completeAssistanceSchema), assistanceController.completeAssistance);
router.post('/assistance/:id/cancel', authenticate, assistanceController.cancelAssistance);

// ============================================
// COMPLAINTS ROUTES
// ============================================
router.post('/complaints', authenticate, apiRateLimiter, validateSchema(progressSchemas.createComplaintSchema), complaintController.createComplaint);
router.get('/complaints/user', authenticate, complaintController.getUserComplaints);
router.get('/complaints', authenticate, authorize(['ADMIN']), complaintController.getAllComplaints);
router.get('/complaints/:id', authenticate, complaintController.getComplaintById);
router.post('/complaints/:id/resolve', authenticate, authorize(['ADMIN']), validateSchema(progressSchemas.resolveComplaintSchema), complaintController.resolveComplaint);
router.post('/complaints/:id/reject', authenticate, authorize(['ADMIN']), validateSchema(progressSchemas.rejectComplaintSchema), complaintController.rejectComplaint);

// ============================================
// QR CODE ROUTES
// ============================================
router.post('/qr/generate', authenticate, authorize(['TRAINER', 'ADMIN']), validateSchema(progressSchemas.generateQRSchema), qrController.generateQR);
router.post('/qr/validate', authenticate, apiRateLimiter, validateSchema(progressSchemas.validateQRSchema), qrController.validateQR);
router.get('/qr/gym/:gymId', authenticate, authorize(['TRAINER', 'ADMIN']), qrController.getGymQRCodes);

router.post('/sync', authenticate, syncController.syncOfflineActions);


// ============================================
// NOTIFICATIONS ROUTES
// ============================================
router.get('/notifications', authenticate, notificationController.getNotifications);
router.patch('/notifications/read-all', authenticate, notificationController.markAllAsRead);
router.patch('/notifications/:id/read', authenticate, notificationController.markAsRead);
router.delete('/notifications/:id', authenticate, notificationController.deleteNotification);
router.get('/notifications/unread/count', authenticate, notificationController.getUnreadCount);

// ============================================
// ANALYTICS ROUTES
// ============================================
router.get('/analytics/me', authenticate, analyticsController.getUserAnalytics);
router.get('/analytics/gym', authenticate, authorize(['ADMIN', 'TRAINER']), analyticsController.getGymAnalytics);
router.get('/analytics/leaderboard', authenticate, analyticsController.getGlobalLeaderboard);
router.get('/analytics/rank', authenticate, analyticsController.getUserRank);
router.get('/analytics/engagement', authenticate, authorize(['ADMIN']), analyticsController.getEngagementMetrics);

export default router;