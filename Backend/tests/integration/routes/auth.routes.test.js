import request from 'supertest';
import express from 'express';
import { prisma } from '../../../src/config/database.js';
import authRoutes from '../../../src/routes/auth.routes.js';
import { users, createUserPayload } from '../../fixtures/index.js';

jest.mock('../../../src/config/database.js');

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    it('should register a new user', async () => {
      const newUser = { id: 'new-id', ...createUserPayload, emailVerified: false };
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(newUser);
      prisma.userSettings.create.mockResolvedValue({});
      prisma.userPoints.create.mockResolvedValue({});

      const response = await request(app)
        .post('/auth/register')
        .send(createUserPayload)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
    });

    it('should reject duplicate email', async () => {
      prisma.user.findUnique.mockResolvedValue(users.regularUser);

      const response = await request(app)
        .post('/auth/register')
        .send(createUserPayload)
        .expect(409);

      expect(response.body.code).toBe('CONFLICT');
    });

    it('should validate password strength', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          ...createUserPayload,
          password: 'weak',
        })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /auth/login', () => {
    it('should login user with correct credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(users.regularUser);

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: users.regularUser.email,
          password: 'TestPassword123!',
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should reject invalid email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'TestPassword123!',
        })
        .expect(401);

      expect(response.body.code).toBe('UNAUTHORIZED');
    });

    it('should reject invalid password', async () => {
      prisma.user.findUnique.mockResolvedValue(users.regularUser);

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: users.regularUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /auth/verify-email', () => {
    it('should verify email with valid token', async () => {
      prisma.user.findUnique.mockResolvedValue(users.unverifiedUser);
      prisma.user.update.mockResolvedValue({ ...users.unverifiedUser, emailVerified: true });

      const response = await request(app)
        .post('/auth/verify-email')
        .send({ token: 'valid-token' })
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /auth/refresh-token', () => {
    it('should return new access token', async () => {
      const response = await request(app)
        .post('/auth/refresh-token')
        .send({ refreshToken: 'valid-refresh-token' })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout user', async () => {
      prisma.user.findUnique.mockResolvedValue(users.regularUser);
      prisma.user.update.mockResolvedValue({});

      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer valid-token`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });
  });
});