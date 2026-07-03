/**
 * PROGRESS & NOTIFICATION SERVICE TESTS
 * Testing: Workout Sessions, Metrics, Progress Tracking, Notifications
 */

import dayjs from 'dayjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/config/prisma.js');
vi.mock('../src/config/redis.js');

import prisma from '../src/config/prisma.js';
import redis from '../src/config/redis.js';
import * as progressService from '../src/services/progress.service.js';
import * as notificationService from '../src/services/notification.service.js';
import * as progressController from '../src/controllers/progress.controller.js';
import * as notificationController from '../src/controllers/notification.controller.js';

describe('PROGRESS SERVICE TESTS', () => {
  const mockWorkoutSession = {
    id: 'session-123',
    userId: 'user-123',
    routineId: 'routine-123',
    duration: 45,
    caloriesBurned: 250,
    intensity: 'HIGH',
    completedAt: new Date(),
    exercises: [],
  };

  const mockMetrics = {
    id: 'metric-123',
    userId: 'user-123',
    weight: 75,
    bodyFat: 18,
    musclesMass: 65,
    recordedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Create Workout Session', () => {
    it('should create a new workout session', async () => {
      prisma.workoutSession.create.mockResolvedValue(mockWorkoutSession);
      redis.del.mockResolvedValue(1);

      const result = await progressService.createWorkoutSession('user-123', {
        routineId: 'routine-123',
        duration: 45,
        caloriesBurned: 250,
        intensity: 'HIGH',
      });

      expect(result).toEqual(mockWorkoutSession);
      expect(prisma.workoutSession.create).toHaveBeenCalled();
    });

    it('should validate workout data', async () => {
      await expect(
        progressService.createWorkoutSession('user-123', {
          duration: -10,
          intensity: 'INVALID',
        })
      ).rejects.toThrow();
    });

    it('should calculate calories if not provided', async () => {
      prisma.workoutSession.create.mockResolvedValue({
        ...mockWorkoutSession,
        caloriesBurned: 250,
      });

      await progressService.createWorkoutSession('user-123', {
        routineId: 'routine-123',
        duration: 45,
        intensity: 'HIGH',
      });

      expect(prisma.workoutSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          caloriesBurned: expect.any(Number),
        }),
      });
    });
  });

  describe('Record Body Metrics', () => {
    it('should record body metrics', async () => {
      prisma.bodyMetric.create.mockResolvedValue(mockMetrics);
      redis.del.mockResolvedValue(1);

      const result = await progressService.recordMetrics('user-123', {
        weight: 75,
        bodyFat: 18,
        musclesMass: 65,
      });

      expect(result).toEqual(mockMetrics);
    });

    it('should validate metric values', async () => {
      await expect(
        progressService.recordMetrics('user-123', {
          weight: -50,
          bodyFat: 150,
        })
      ).rejects.toThrow();
    });

    it('should prevent duplicate metrics on same day', async () => {
      prisma.bodyMetric.findFirst.mockResolvedValue(mockMetrics);

      await expect(
        progressService.recordMetrics('user-123', {
          weight: 75,
          bodyFat: 18,
        })
      ).rejects.toThrow('Already recorded today');
    });

    it('should allow metric update if forced', async () => {
      prisma.bodyMetric.findFirst.mockResolvedValue(mockMetrics);
      prisma.bodyMetric.update.mockResolvedValue(mockMetrics);
      redis.del.mockResolvedValue(1);

      const result = await progressService.recordMetrics(
        'user-123',
        { weight: 76, bodyFat: 17 },
        { forceUpdate: true }
      );

      expect(result).toBeDefined();
    });
  });

  describe('Get Progress History', () => {
    it('should retrieve workout history', async () => {
      const sessions = [
        mockWorkoutSession,
        { ...mockWorkoutSession, id: 'session-456' },
      ];
      prisma.workoutSession.findMany.mockResolvedValue(sessions);
      redis.get.mockResolvedValue(null);

      const result = await progressService.getProgressHistory('user-123');

      expect(result).toHaveLength(2);
    });

    it('should filter by date range', async () => {
      prisma.workoutSession.findMany.mockResolvedValue([mockWorkoutSession]);

      const startDate = dayjs().subtract(30, 'days').toDate();
      const endDate = dayjs().toDate();

      await progressService.getProgressHistory('user-123', {
        startDate,
        endDate,
      });

      expect(prisma.workoutSession.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          completedAt: expect.any(Object),
        }),
      });
    });

    it('should support pagination', async () => {
      prisma.workoutSession.findMany.mockResolvedValue([mockWorkoutSession]);

      await progressService.getProgressHistory('user-123', { page: 2, limit: 10 });

      expect(prisma.workoutSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });
  });

  describe('Complete Exercise', () => {
    it('should mark exercise as completed', async () => {
      const completedExercise = {
        id: 'exercise-log-123',
        sessionId: 'session-123',
        exerciseId: 'exercise-123',
        setsCompleted: 3,
        repsCompleted: [10, 10, 8],
        weightUsed: 50,
        completedAt: new Date(),
      };

      prisma.exerciseLog.create.mockResolvedValue(completedExercise);
      redis.del.mockResolvedValue(1);

      const result = await progressService.completeExercise('session-123', {
        exerciseId: 'exercise-123',
        setsCompleted: 3,
        repsCompleted: [10, 10, 8],
        weightUsed: 50,
      });

      expect(result).toBeDefined();
    });

    it('should calculate one rep max', async () => {
      prisma.exerciseLog.create.mockResolvedValue({});
      redis.del.mockResolvedValue(1);

      await progressService.completeExercise('session-123', {
        exerciseId: 'exercise-123',
        setsCompleted: 1,
        repsCompleted: [5],
        weightUsed: 100,
      });

      expect(prisma.exerciseLog.create).toHaveBeenCalled();
    });
  });

  describe('Get Personal Records', () => {
    it('should return user personal records', async () => {
      const prs = [
        {
          exerciseId: 'exercise-123',
          exerciseName: 'Bench Press',
          oneRepMax: 150,
          recordedAt: new Date(),
        },
        {
          exerciseId: 'exercise-456',
          exerciseName: 'Squat',
          oneRepMax: 200,
          recordedAt: new Date(),
        },
      ];

      prisma.personalRecord.findMany.mockResolvedValue(prs);
      redis.get.mockResolvedValue(null);

      const result = await progressService.getPersonalRecords('user-123');

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('oneRepMax');
    });

    it('should cache personal records', async () => {
      redis.get.mockResolvedValue(JSON.stringify([
        { exerciseId: 'exercise-123', oneRepMax: 150 },
      ]));

      const result = await progressService.getPersonalRecords('user-123');

      expect(result).toHaveLength(1);
    });
  });

  describe('Get User Statistics', () => {
    it('should return comprehensive statistics', async () => {
      prisma.workoutSession.findMany.mockResolvedValue(
        Array(45).fill(mockWorkoutSession)
      );
      prisma.workoutSession.aggregate.mockResolvedValue({
        _sum: { caloriesBurned: 11250, duration: 2025 },
      });
      prisma.bodyMetric.findFirst.mockResolvedValue(mockMetrics);

      const result = await progressService.getStats('user-123');

      expect(result).toHaveProperty('totalWorkouts');
      expect(result).toHaveProperty('totalCaloriesBurned');
      expect(result).toHaveProperty('averageSessionDuration');
      expect(result).toHaveProperty('lastMetrics');
    });

    it('should calculate streak', async () => {
      prisma.workoutSession.findMany.mockResolvedValue(
        Array(5).fill(mockWorkoutSession)
      );

      const result = await progressService.getStats('user-123');

      expect(result).toHaveProperty('currentStreak');
    });
  });

  describe('Get Streak', () => {
    it('should calculate current workout streak', async () => {
      const today = dayjs();
      const sessions = Array(7).fill(null).map((_, i) => ({
        completedAt: today.subtract(i, 'days').toDate(),
      }));

      prisma.workoutSession.findMany.mockResolvedValue(sessions);

      const result = await progressService.getStreak('user-123');

      expect(result.currentStreak).toBe(7);
    });

    it('should break streak on missing day', async () => {
      const today = dayjs();
      const sessions = [
        { completedAt: today.toDate() },
        { completedAt: today.subtract(1, 'days').toDate() },
        // Skip day 2
        { completedAt: today.subtract(3, 'days').toDate() },
      ];

      prisma.workoutSession.findMany.mockResolvedValue(sessions);

      const result = await progressService.getStreak('user-123');

      expect(result.currentStreak).toBe(1);
    });

    it('should return longest streak', async () => {
      prisma.workoutSession.findMany.mockResolvedValue([]);

      const result = await progressService.getStreak('user-123');

      expect(result).toHaveProperty('longestStreak');
    });
  });
});

describe('NOTIFICATION SERVICE TESTS', () => {
  const mockNotification = {
    id: 'notification-123',
    userId: 'user-123',
    type: 'ACHIEVEMENT_UNLOCKED',
    title: 'Achievement Unlocked!',
    message: 'You unlocked the "First Workout" achievement!',
    data: { achievementId: 'achievement-123' },
    isRead: false,
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Send Notification', () => {
    it('should send notification successfully', async () => {
      prisma.notification.create.mockResolvedValue(mockNotification);
      redis.del.mockResolvedValue(1);

      const result = await notificationService.sendNotification('user-123', {
        type: 'ACHIEVEMENT_UNLOCKED',
        title: 'Achievement Unlocked!',
        message: 'You unlocked an achievement!',
      });

      expect(result).toEqual(mockNotification);
    });

    it('should validate notification type', async () => {
      await expect(
        notificationService.sendNotification('user-123', {
          type: 'INVALID_TYPE',
          title: 'Test',
        })
      ).rejects.toThrow();
    });

    it('should send email notification', async () => {
      prisma.notification.create.mockResolvedValue(mockNotification);
      prisma.user.findUnique.mockResolvedValue({
        email: 'user@example.com',
      });

      await notificationService.sendNotification('user-123', {
        type: 'ACHIEVEMENT_UNLOCKED',
        title: 'Test',
        sendEmail: true,
      });

      expect(prisma.notification.create).toHaveBeenCalled();
    });

    it('should send push notification', async () => {
      prisma.notification.create.mockResolvedValue(mockNotification);

      await notificationService.sendNotification('user-123', {
        type: 'ACHIEVEMENT_UNLOCKED',
        title: 'Test',
        sendPush: true,
      });

      expect(prisma.notification.create).toHaveBeenCalled();
    });
  });

  describe('Get User Notifications', () => {
    it('should retrieve user notifications', async () => {
      const notifications = [
        mockNotification,
        { ...mockNotification, id: 'notification-456' },
      ];
      prisma.notification.findMany.mockResolvedValue(notifications);
      redis.get.mockResolvedValue(null);

      const result = await notificationService.getNotifications('user-123');

      expect(result).toHaveLength(2);
    });

    it('should filter unread notifications', async () => {
      prisma.notification.findMany.mockResolvedValue([mockNotification]);

      await notificationService.getNotifications('user-123', { unreadOnly: true });

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          isRead: false,
        }),
      });
    });

    it('should support pagination', async () => {
      prisma.notification.findMany.mockResolvedValue([mockNotification]);

      await notificationService.getNotifications('user-123', { page: 2, limit: 20 });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 20,
        })
      );
    });
  });

  describe('Mark Notification as Read', () => {
    it('should mark single notification as read', async () => {
      const readNotification = { ...mockNotification, isRead: true };
      prisma.notification.update.mockResolvedValue(readNotification);
      redis.del.mockResolvedValue(1);

      const result = await notificationService.markAsRead('notification-123');

      expect(result.isRead).toBe(true);
    });

    it('should mark all notifications as read', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 5 });
      redis.del.mockResolvedValue(1);

      const result = await notificationService.markAllAsRead('user-123');

      expect(result).toHaveProperty('count');
    });

    it('should throw error for non-existent notification', async () => {
      prisma.notification.update.mockRejectedValue(new Error('Not found'));

      await expect(notificationService.markAsRead('nonexistent')).rejects.toThrow();
    });
  });

  describe('Delete Notification', () => {
    it('should delete notification', async () => {
      prisma.notification.delete.mockResolvedValue(mockNotification);
      redis.del.mockResolvedValue(1);

      const result = await notificationService.deleteNotification('notification-123');

      expect(result).toHaveProperty('message');
    });

    it('should delete all notifications', async () => {
      prisma.notification.deleteMany.mockResolvedValue({ count: 10 });
      redis.del.mockResolvedValue(1);

      const result = await notificationService.deleteAllNotifications('user-123');

      expect(result.count).toBe(10);
    });
  });

  describe('Get Unread Count', () => {
    it('should return count of unread notifications', async () => {
      prisma.notification.count.mockResolvedValue(5);
      redis.get.mockResolvedValue(null);
      redis.setex.mockResolvedValue('OK');

      const result = await notificationService.getUnreadCount('user-123');

      expect(result).toBe(5);
    });

    it('should cache unread count', async () => {
      redis.get.mockResolvedValue('3');

      const result = await notificationService.getUnreadCount('user-123');

      expect(result).toBe(3);
    });
  });

  describe('Email Notifications', () => {
    it('should send email notification', async () => {
      prisma.user.findUnique.mockResolvedValue({
        email: 'user@example.com',
      });

      await notificationService.sendEmailNotification('user-123', {
        subject: 'Achievement Unlocked',
        template: 'achievement',
      });

      expect(prisma.user.findUnique).toHaveBeenCalled();
    });

    it('should respect email preferences', async () => {
      prisma.user.findUnique.mockResolvedValue({
        email: 'user@example.com',
        preferences: { emailNotifications: false },
      });

      await expect(
        notificationService.sendEmailNotification('user-123', {
          subject: 'Test',
        })
      ).rejects.toThrow('Email notifications disabled');
    });
  });

  describe('Push Notifications', () => {
    it('should send push notification', async () => {
      prisma.pushToken.findMany.mockResolvedValue([
        { token: 'push-token-123' },
      ]);

      await notificationService.sendPushNotification('user-123', {
        title: 'Test',
        body: 'Push notification',
      });

      expect(prisma.pushToken.findMany).toHaveBeenCalled();
    });

    it('should handle push token not found', async () => {
      prisma.pushToken.findMany.mockResolvedValue([]);

      const result = await notificationService.sendPushNotification('user-123', {
        title: 'Test',
      });

      expect(result).toHaveProperty('message');
    });
  });
});

describe('PROGRESS CONTROLLER TESTS', () => {
  let req, res, next;

  beforeEach(() => {
    req = { user: { id: 'user-123' }, body: {}, validatedData: {}, params: {} };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    next = vi.fn();
    vi.clearAllMocks();
  });

  describe('Create Workout Controller', () => {
    it('should create workout session', async () => {
      vi.spyOn(progressService, 'createWorkoutSession').mockResolvedValue({
        id: 'session-123',
      });

      await progressController.createWorkoutSession(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('Get Progress History Controller', () => {
    it('should return progress history', async () => {
      vi.spyOn(progressService, 'getProgressHistory').mockResolvedValue([]);

      await progressController.getProgressHistory(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('Get Statistics Controller', () => {
    it('should return user statistics', async () => {
      vi.spyOn(progressService, 'getStats').mockResolvedValue({
        totalWorkouts: 45,
      });

      await progressController.getStats(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          totalWorkouts: 45,
        }),
      });
    });
  });
});

describe('NOTIFICATION CONTROLLER TESTS', () => {
  let req, res, next;

  beforeEach(() => {
    req = { user: { id: 'user-123' }, body: {}, validatedData: {}, params: {} };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    next = vi.fn();
    vi.clearAllMocks();
  });

  describe('Get Notifications Controller', () => {
    it('should return user notifications', async () => {
      vi.spyOn(notificationService, 'getNotifications').mockResolvedValue([]);

      await notificationController.getNotifications(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('Mark as Read Controller', () => {
    it('should mark notification as read', async () => {
      vi.spyOn(notificationService, 'markAsRead').mockResolvedValue({
        isRead: true,
      });

      await notificationController.markAsRead(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('Get Unread Count Controller', () => {
    it('should return unread count', async () => {
      vi.spyOn(notificationService, 'getUnreadCount').mockResolvedValue(5);

      await notificationController.getUnreadCount(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { unreadCount: 5 },
      });
    });
  });
});