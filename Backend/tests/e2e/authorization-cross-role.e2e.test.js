import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { createUserAndLogin } from '../helpers/testAuth.js';

vi.mock('../../src/config/prisma.js', async () => {
  const { createE2EPrismaMock } = await import('../helpers/e2ePrismaMock.js');
  return { default: createE2EPrismaMock({ roleFromName: true }) };
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

describe('Authorization Cross-Role E2E', () => {
  let server;
  let userToken;
  let trainerToken;
  let adminToken;

  beforeAll(() => {
    server = app.listen(3005);
  });

  afterAll(async () => {
    server.close();
  });

  beforeEach(async () => {
    // Normal user
    const userRes = await createUserAndLogin(server, prisma, {
      email: `user-${Date.now()}@example.com`,
      firstName: 'Normal',
      lastName: 'User',
    });
    userToken = userRes.accessToken;

    // Trainer
    const trainerRes = await createUserAndLogin(server, prisma, {
      email: `trainer-${Date.now()}@example.com`,
      firstName: 'Trainer',
      lastName: 'User',
    });
    trainerToken = trainerRes.accessToken;

    // Admin
    const adminRes = await createUserAndLogin(server, prisma, {
      email: `admin-${Date.now()}@example.com`,
      firstName: 'Admin',
      lastName: 'User',
    });
    adminToken = adminRes.accessToken;
  });

  describe('TRAINER-only routes', () => {
    it('USER recibe 403 en PATCH /assistance/:id/assign (TRAINER-only)', async () => {
      const response = await request(server)
        .patch('/assistance/assist-1/assign')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ trainerId: crypto.randomUUID() });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('TRAINER obtiene acceso a PATCH /assistance/:id/assign', async () => {
      const response = await request(server)
        .patch('/assistance/assist-1/assign')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ trainerId: crypto.randomUUID() });

      // May fail for other reasons (e.g. assistance not found), but not 403
      expect(response.status).not.toBe(403);
    });
  });

  describe('ADMIN-only routes', () => {
    it('USER recibe 403 en PATCH /users/:id/status (ADMIN-only)', async () => {
      const response = await request(server)
        .patch('/users/user-123/status')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ isActive: false });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('TRAINER recibe 403 en PATCH /users/:id/status (ADMIN-only)', async () => {
      const response = await request(server)
        .patch('/users/user-123/status')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ isActive: false });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('ADMIN obtiene acceso a PATCH /users/:id/status', async () => {
      const response = await request(server)
        .patch('/users/user-123/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      // May fail for other reasons (e.g. user not found), but not 403
      expect(response.status).not.toBe(403);
    });
  });

  describe('Reward redemption (ADMIN approval)', () => {
    it('USER CANNOT change a redemption status to APPROVED', async () => {
      const response = await request(server)
        .patch('/rewards/redemptions/redemption-1')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'APPROVED' });

      expect(response.status).toBe(403);
    });

    it('ADMIN can change a redemption status', async () => {
      const response = await request(server)
        .patch('/rewards/redemptions/redemption-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'APPROVED' });

      // May fail for other reasons (e.g. redemption not found), but not 403
      expect(response.status).not.toBe(403);
    });
  });
});
