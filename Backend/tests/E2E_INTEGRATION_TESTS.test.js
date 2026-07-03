/**
 * END-TO-END INTEGRATION TESTS
 * Testing: Complete user workflows, API integration, data consistency
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/config/prisma.js');
vi.mock('../src/config/redis.js');

import prisma from '../src/config/prisma.js';
import redis from '../src/config/redis.js';
import app from '../src/app.js';

const baseURL = 'http://localhost:3000/api';

describe('END-TO-END INTEGRATION TESTS', () => {
  const testUser = {
    email: 'e2e-test@example.com',
    password: 'E2ETestPass123!',
    firstName: 'E2E',
    lastName: 'Test',
  };

  let authToken;
  let userId;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete User Registration & Login Flow', () => {
    it('should register new user and login successfully', async () => {
      // Mock registration
      prisma.user.findUnique.mockResolvedValueOnce(null);
      prisma.user.create.mockResolvedValueOnce({
        id: 'user-e2e-123',
        ...testUser,
        role: 'USER',
        points: 0,
        level: 1,
        isActive: true,
      });

      // Mock login
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-e2e-123',
        ...testUser,
        passwordHash: 'hashed',
        isActive: true,
      });

      redis.setex.mockResolvedValue('OK');

      // Register
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(registerRes.body).toHaveProperty('data.accessToken');
      expect(registerRes.body).toHaveProperty('data.user.id');

      userId = registerRes.body.data.user.id;
      authToken = registerRes.body.data.accessToken;

      // Login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(loginRes.body.data).toHaveProperty('accessToken');
      expect(loginRes.body.data.user.email).toBe(testUser.email);
    });

    it('should refresh token and maintain session', async () => {
      const oldToken = 'old_access_token';
      const newToken = 'new_access_token';

      prisma.user.findUnique.mockResolvedValue({
        id: userId,
        ...testUser,
      });

      redis.setex.mockResolvedValue('OK');

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${oldToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.accessToken).not.toBe(oldToken);
    });

    it('should logout and invalidate token', async () => {
      redis.setex.mockResolvedValue('OK');

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(redis.setex).toHaveBeenCalled();
    });
  });

  describe('User Profile & Settings Flow', () => {
    it('should get and update user profile', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: userId,
        ...testUser,
        bio: 'Original bio',
      });

      // Get profile
      const getRes = await request(app)
        .get(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getRes.body.data.email).toBe(testUser.email);

      // Update profile
      const updateData = { bio: 'Updated bio', firstName: 'UpdatedName' };
      prisma.user.update.mockResolvedValue({
        id: userId,
        ...testUser,
        ...updateData,
      });
      redis.del.mockResolvedValue(1);

      const updateRes = await request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(updateRes.body.data.bio).toBe(updateData.bio);
      expect(redis.del).toHaveBeenCalled();
    });

    it('should update user preferences', async () => {
      const preferences = {
        emailNotifications: false,
        pushNotifications: true,
        theme: 'dark',
      };

      prisma.userPreferences.upsert.mockResolvedValue(preferences);
      redis.del.mockResolvedValue(1);

      const res = await request(app)
        .post(`/api/users/${userId}/preferences`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(preferences)
        .expect(200);

      expect(res.body.data).toEqual(preferences);
    });
  });

  describe('Challenge Participation Flow', () => {
    it('should list, join, and complete challenge', async () => {
      const mockChallenge = {
        id: 'challenge-e2e-123',
        title: 'E2E Challenge',
        difficulty: 'MEDIUM',
        duration: 30,
        pointsReward: 500,
        status: 'ACTIVE',
      };

      // List challenges
      prisma.challenge.findMany.mockResolvedValueOnce([mockChallenge]);
      redis.get.mockResolvedValueOnce(null);

      const listRes = await request(app)
        .get('/api/challenges')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(listRes.body.data).toHaveLength(1);
      expect(listRes.body.data[0].title).toBe(mockChallenge.title);

      // Join challenge
      prisma.challengeParticipant.create.mockResolvedValueOnce({
        userId: userId,
        challengeId: mockChallenge.id,
        progress: 0,
      });
      redis.del.mockResolvedValue(1);

      const joinRes = await request(app)
        .post(`/api/challenges/${mockChallenge.id}/join`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(joinRes.body.data.userId).toBe(userId);

      // Update progress
      prisma.challengeParticipant.update.mockResolvedValueOnce({
        progress: 50,
      });

      const progressRes = await request(app)
        .put(`/api/challenges/${mockChallenge.id}/progress`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ progress: 50 })
        .expect(200);

      expect(progressRes.body.data.progress).toBe(50);

      // Complete challenge
      prisma.challengeParticipant.update.mockResolvedValueOnce({
        progress: 100,
        completedAt: new Date(),
      });
      prisma.user.update.mockResolvedValueOnce({
        points: 500,
      });

      const completeRes = await request(app)
        .put(`/api/challenges/${mockChallenge.id}/progress`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ progress: 100 })
        .expect(200);

      expect(completeRes.body.data.completedAt).toBeDefined();
    });

    it('should view challenge leaderboard', async () => {
      const leaderboard = [
        { rank: 1, userId: 'user-1', progress: 100 },
        { rank: 2, userId: userId, progress: 75 },
      ];

      prisma.challengeParticipant.findMany.mockResolvedValue(leaderboard);
      redis.get.mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/challenges/challenge-123/leaderboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].rank).toBe(1);
    });
  });

  describe('Workout & Progress Tracking Flow', () => {
    it('should create routine, add exercises, and log workout', async () => {
      // Create routine
      const routineData = {
        name: 'E2E Routine',
        difficulty: 'BEGINNER',
        duration: 30,
      };

      prisma.routine.create.mockResolvedValueOnce({
        id: 'routine-e2e-123',
        userId,
        ...routineData,
      });
      redis.del.mockResolvedValue(1);

      const routineRes = await request(app)
        .post('/api/routines')
        .set('Authorization', `Bearer ${authToken}`)
        .send(routineData)
        .expect(201);

      const routineId = routineRes.body.data.id;
      expect(routineRes.body.data.name).toBe(routineData.name);

      // Add exercise
      const exerciseData = {
        name: 'Push-ups',
        sets: 3,
        reps: 10,
      };

      prisma.routineExercise.create.mockResolvedValueOnce({
        id: 'exercise-e2e-123',
        routineId,
        ...exerciseData,
      });
      redis.del.mockResolvedValue(1);

      const exerciseRes = await request(app)
        .post(`/api/routines/${routineId}/exercises`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(exerciseData)
        .expect(201);

      expect(exerciseRes.body.data.name).toBe(exerciseData.name);

      // Log workout
      const workoutData = {
        routineId,
        duration: 45,
        caloriesBurned: 250,
        intensity: 'HIGH',
      };

      prisma.workoutSession.create.mockResolvedValueOnce({
        id: 'session-e2e-123',
        userId,
        ...workoutData,
      });
      redis.del.mockResolvedValue(1);

      const workoutRes = await request(app)
        .post('/api/progress/workouts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(workoutData)
        .expect(201);

      expect(workoutRes.body.data.intensity).toBe(workoutData.intensity);
    });

    it('should track metrics and view progress statistics', async () => {
      const metrics = {
        weight: 75,
        bodyFat: 18,
        musclesMass: 65,
      };

      prisma.bodyMetric.create.mockResolvedValueOnce({
        id: 'metric-e2e-123',
        userId,
        ...metrics,
      });
      redis.del.mockResolvedValue(1);

      const metricsRes = await request(app)
        .post('/api/progress/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .send(metrics)
        .expect(201);

      expect(metricsRes.body.data.weight).toBe(metrics.weight);

      // Get statistics
      prisma.workoutSession.findMany.mockResolvedValue(
        Array(45).fill({ duration: 45, caloriesBurned: 250 })
      );
      prisma.workoutSession.aggregate.mockResolvedValue({
        _sum: { caloriesBurned: 11250, duration: 2025 },
      });

      const statsRes = await request(app)
        .get('/api/progress/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(statsRes.body.data).toHaveProperty('totalWorkouts');
      expect(statsRes.body.data).toHaveProperty('totalCaloriesBurned');
    });

    it('should track and view workout streak', async () => {
      const today = new Date();
      const sessions = Array(7).fill(null).map((_, i) => ({
        completedAt: new Date(today.getTime() - i * 24 * 60 * 60 * 1000),
      }));

      prisma.workoutSession.findMany.mockResolvedValue(sessions);
      redis.get.mockResolvedValueOnce(null);
      redis.setex.mockResolvedValue('OK');

      const res = await request(app)
        .get('/api/progress/streak')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('currentStreak');
      expect(res.body.data.currentStreak).toBe(7);
    });
  });

  describe('Gamification & Rewards Flow', () => {
    it('should earn points and unlock achievements', async () => {
      // Add points
      prisma.user.update.mockResolvedValueOnce({
        id: userId,
        points: 1500,
      });
      redis.del.mockResolvedValue(1);

      const pointsRes = await request(app)
        .post(`/api/gamification/points`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ points: 500, action: 'WORKOUT_COMPLETED' })
        .expect(200);

      expect(pointsRes.body.data.points).toBe(1500);

      // Get achievements
      const achievements = [
        {
          id: 'achievement-1',
          name: 'First Workout',
          unlockedAt: new Date(),
        },
      ];

      prisma.userAchievement.findMany.mockResolvedValue(achievements);
      redis.get.mockResolvedValueOnce(null);

      const achievRes = await request(app)
        .get('/api/gamification/achievements')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(achievRes.body.data).toHaveLength(1);
      expect(achievRes.body.data[0].unlockedAt).toBeDefined();

      // View leaderboard
      const leaderboard = [
        { id: 'user-1', points: 5000, level: 10 },
        { id: userId, points: 1500, level: 3 },
      ];

      prisma.user.findMany.mockResolvedValue(leaderboard);
      redis.get.mockResolvedValueOnce(null);

      const leaderRes = await request(app)
        .get('/api/gamification/leaderboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(leaderRes.body.data).toHaveLength(2);
    });

    it('should redeem rewards', async () => {
      const reward = {
        id: 'reward-1',
        name: 'Premium Access',
        cost: 500,
      };

      prisma.reward.findUnique.mockResolvedValueOnce(reward);
      prisma.user.findUnique.mockResolvedValueOnce({
        id: userId,
        points: 1000,
      });
      prisma.userReward.create.mockResolvedValueOnce({
        userId,
        rewardId: reward.id,
      });
      prisma.user.update.mockResolvedValueOnce({
        points: 500,
      });
      redis.del.mockResolvedValue(1);

      const res = await request(app)
        .post(`/api/gamification/rewards/${reward.id}/redeem`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe('Notifications Flow', () => {
    it('should send and retrieve notifications', async () => {
      // Send notification
      const notificationData = {
        type: 'ACHIEVEMENT_UNLOCKED',
        title: 'Achievement!',
        message: 'You unlocked an achievement!',
      };

      prisma.notification.create.mockResolvedValueOnce({
        id: 'notif-e2e-123',
        userId,
        ...notificationData,
        isRead: false,
      });
      redis.del.mockResolvedValue(1);

      const sendRes = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(notificationData)
        .expect(201);

      expect(sendRes.body.data).toHaveProperty('id');

      // Get notifications
      prisma.notification.findMany.mockResolvedValue([
        sendRes.body.data,
      ]);
      redis.get.mockResolvedValueOnce(null);

      const getRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getRes.body.data).toHaveLength(1);

      // Mark as read
      prisma.notification.update.mockResolvedValueOnce({
        ...sendRes.body.data,
        isRead: true,
      });
      redis.del.mockResolvedValue(1);

      const readRes = await request(app)
        .put(`/api/notifications/${sendRes.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ isRead: true })
        .expect(200);

      expect(readRes.body.data.isRead).toBe(true);
    });

    it('should get unread notification count', async () => {
      prisma.notification.count.mockResolvedValue(5);
      redis.get.mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data.unreadCount).toBe(5);
    });
  });

  describe('Cache Consistency', () => {
    it('should invalidate cache on data updates', async () => {
      prisma.user.update.mockResolvedValue({});
      redis.del.mockResolvedValue(1);

      await request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Updated' })
        .expect(200);

      expect(redis.del).toHaveBeenCalled();
    });

    it('should use cached data when available', async () => {
      const cachedUser = JSON.stringify({
        id: userId,
        email: testUser.email,
      });

      redis.get.mockResolvedValueOnce(cachedUser);

      await request(app)
        .get(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(redis.get).toHaveBeenCalled();
    });
  });

  describe('Error Handling & Validation', () => {
    it('should handle validation errors', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'weak',
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBeDefined();
    });

    it('should handle unauthorized requests', async () => {
      const res = await request(app)
        .get(`/api/users/${userId}`)
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should handle not found errors', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/users/nonexistent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('should handle rate limiting', async () => {
      redis.incr.mockResolvedValue(101);
      redis.ttl.mockResolvedValue(30);

      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(429);

      expect(res.status).toBe(429);
    });
  });
});