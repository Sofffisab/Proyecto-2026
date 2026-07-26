import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createUserAndLogin } from '../helpers/testAuth.js';

vi.mock('../../src/config/prisma.js', async () => {
  const { createE2EPrismaMock } = await import('../helpers/e2ePrismaMock.js');
  return { default: createE2EPrismaMock() };
});

vi.mock('../../src/config/redis.js', async () => {
  const { createE2ERedisMock } = await import('../helpers/e2ePrismaMock.js');
  return { default: createE2ERedisMock() };
});

vi.mock('../../src/middlewares/rateLimiter.js', () => {
  const passthrough = (req, res, next) => next();
  return {
    authRateLimiter: passthrough,
    apiRateLimiter: passthrough,
    default: { authRateLimiter: passthrough, apiRateLimiter: passthrough },
  };
});

const prisma = (await import('../../src/config/prisma.js')).default;
const app = (await import('../../src/server.js')).default;

describe('Auth E2E', () => {
  let server;
  let authToken;
  let userId;

  beforeAll(() => {
    server = app.listen(3001);
  });

  afterAll(async () => {
    server.close();
  });

  beforeEach(() => {
    authToken = null;
    userId = null;
  });

  describe('POST /auth/users (admin-created accounts)', () => {
    let adminToken;

    beforeEach(async () => {
      const admin = await createUserAndLogin(server, prisma, {
        email: `auth-admin-${Date.now()}@example.com`,
        firstName: 'Admin',
        lastName: 'Owner',
        role: 'ADMIN',
      });
      adminToken = admin.accessToken;
    });

    it('creates a new user account (role defaults to USER)', async () => {
      const response = await request(server)
        .post('/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: `test-${Date.now()}@example.com`,
          firstName: 'Test',
          lastName: 'User',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBe('USER');
      // The generated placeholder password/reset-token fields must never
      // leak in the response.
      expect(response.body.data.passwordHash).toBeUndefined();
    });

    it('rejects non-admin callers', async () => {
      const member = await createUserAndLogin(server, prisma, {
        email: `auth-member-${Date.now()}@example.com`,
        firstName: 'Member',
        lastName: 'User',
      });

      const response = await request(server)
        .post('/auth/users')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({
          email: `blocked-${Date.now()}@example.com`,
          firstName: 'Should',
          lastName: 'Fail',
        });

      expect(response.status).toBe(403);
    });

    it('rejects a duplicate email', async () => {
      const email = `dup-${Date.now()}@example.com`;

      await request(server)
        .post('/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email, firstName: 'First', lastName: 'User' });

      const response = await request(server)
        .post('/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email, firstName: 'Second', lastName: 'User' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('rejects a missing required field', async () => {
      const response = await request(server)
        .post('/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: `incomplete-${Date.now()}@example.com`,
          firstName: 'Test',
          // lastName intentionally omitted
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /auth/login', () => {
    let testEmail;

    beforeEach(async () => {
      testEmail = `login-${Date.now()}@example.com`;
      await createUserAndLogin(server, prisma, {
        email: testEmail,
        firstName: 'Test',
        lastName: 'User',
      });
    });

    it('returns tokens with valid credentials', async () => {
      const response = await request(server)
        .post('/auth/login')
        .send({
          email: testEmail,
          password: 'SecurePassword123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();

      authToken = response.body.data.accessToken;
    });

    it('rejects an incorrect password', async () => {
      const response = await request(server)
        .post('/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('rejects a non-existent email', async () => {
      const response = await request(server)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SecurePassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /auth/refresh', () => {
    it('generates a new access token with a valid refresh token', async () => {
      const registerRes = await createUserAndLogin(server, prisma, {
        email: `refresh-${Date.now()}@example.com`,
        firstName: 'Test',
        lastName: 'User',
      });

      const refreshToken = registerRes.refreshToken;

      const response = await request(server)
        .post('/auth/refresh-token')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
    });

    it('rejects an invalid refresh token', async () => {
      const response = await request(server)
        .post('/auth/refresh-token')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /auth/logout', () => {
    it('agrega token a blacklist de Redis', async () => {
      const registerRes = await createUserAndLogin(server, prisma, {
        email: `logout-${Date.now()}@example.com`,
        firstName: 'Test',
        lastName: 'User',
      });

      const token = registerRes.accessToken;

      const response = await request(server)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Token should now be on the blacklist
      const protectedRes = await request(server)
        .get('/user/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(protectedRes.status).toBe(401);
    });
  });
});
