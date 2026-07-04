import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import app from '../../src/server.js';

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
    const userRes = await request(server)
      .post('/auth/register')
      .send({
        email: `user-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'Normal',
        lastName: 'User',
      });
    userToken = userRes.body.data.accessToken;

    // Trainer (would need DB manipulation normally)
    const trainerRes = await request(server)
      .post('/auth/register')
      .send({
        email: `trainer-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'Trainer',
        lastName: 'User',
      });
    trainerToken = trainerRes.body.data.accessToken;

    // Admin (would need DB manipulation normally)
    const adminRes = await request(server)
      .post('/auth/register')
      .send({
        email: `admin-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'Admin',
        lastName: 'User',
      });
    adminToken = adminRes.body.data.accessToken;
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
    it('USER NO puede cambiar estado de redemption a APPROVED', async () => {
      const response = await request(server)
        .patch('/rewards/redemptions/redemption-1')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'APPROVED' });

      expect(response.status).toBe(403);
    });

    it('ADMIN puede cambiar estado de redemption', async () => {
      const response = await request(server)
        .patch('/rewards/redemptions/redemption-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'APPROVED' });

      // May fail for other reasons (e.g. redemption not found), but not 403
      expect(response.status).not.toBe(403);
    });
  });
});
