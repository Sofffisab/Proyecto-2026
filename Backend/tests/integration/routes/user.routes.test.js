import request from 'supertest';
import express from 'express';
import { prisma } from '../../../src/config/database.js';
import userRoutes from '../../../src/routes/user.routes.js';
import { users, updateProfilePayload } from '../../fixtures/index.js';

jest.mock('../../../src/config/database.js');

const app = express();
app.use(express.json());

// Mock auth middleware
app.use((req, res, next) => {
  req.user = users.regularUser;
  next();
});

app.use('/users', userRoutes);

describe('User Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /users/profile', () => {
    it('should return user profile', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...users.regularUser,
        profile: users.createUserProfile,
        points: users.createUserPoints,
      });

      const response = await request(app)
        .get('/users/profile')
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(users.regularUser.email);
    });
  });

  describe('PUT /users/profile', () => {
    it('should update user profile', async () => {
      const updated = { ...users.regularUser, ...updateProfilePayload };
      prisma.user.update.mockResolvedValue(updated);

      const response = await request(app)
        .put('/users/profile')
        .send(updateProfilePayload)
        .expect(200);

      expect(response.body.user.fullName).toBe(updateProfilePayload.fullName);
    });

    it('should validate profile data', async () => {
      const response = await request(app)
        .put('/users/profile')
        .send({ age: 150 })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /users/points', () => {
    it('should return user points', async () => {
      prisma.userPoints.findUnique.mockResolvedValue(users.createUserPoints);

      const response = await request(app)
        .get('/users/points')
        .expect(200);

      expect(response.body).toHaveProperty('points');
    });
  });

  describe('POST /users/pause-account', () => {
    it('should pause user account', async () => {
      prisma.user.update.mockResolvedValue({
        ...users.regularUser,
        accountPaused: true,
      });

      const response = await request(app)
        .post('/users/pause-account')
        .send({ reason: 'Taking a break' })
        .expect(200);

      expect(response.body.message).toContain('paused');
    });
  });

  describe('POST /users/resume-account', () => {
    it('should resume paused account', async () => {
      req.user = users.pausedUser;

      prisma.user.update.mockResolvedValue({
        ...users.pausedUser,
        accountPaused: false,
      });

      const response = await request(app)
        .post('/users/resume-account')
        .expect(200);

      expect(response.body.message).toContain('resumed');
    });
  });

  describe('POST /users/follow/:userId', () => {
    it('should follow another user', async () => {
      prisma.socialInteraction.create.mockResolvedValue({
        id: 'interaction-001',
        initiatorId: users.regularUser.id,
        receiverId: users.trainerUser.id,
        type: 'follow',
        status: 'pending',
      });

      const response = await request(app)
        .post(`/users/follow/${users.trainerUser.id}`)
        .expect(200);

      expect(response.body).toHaveProperty('interaction');
    });
  });

  describe('POST /users/block/:userId', () => {
    it('should block another user', async () => {
      prisma.blocked.create.mockResolvedValue({
        userId: users.regularUser.id,
        blockedUserId: users.trainerUser.id,
      });

      const response = await request(app)
        .post(`/users/block/${users.trainerUser.id}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });
  });
});