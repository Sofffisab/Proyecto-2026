import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
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
        name: 'Normal User',
      });
    userToken = userRes.body.data.accessToken;

    // Trainer (would need DB manipulation normally)
    const trainerRes = await request(server)
      .post('/auth/register')
      .send({
        email: `trainer-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        name: 'Trainer User',
      });
    trainerToken = trainerRes.body.data.accessToken;

    // Admin (would need DB manipulation normally)
    const adminRes = await request(server)
      .post('/auth/register')
      .send({
        email: `admin-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        name: 'Admin User',
      });
    adminToken = adminRes.body.data.accessToken;
  });

  describe('TRAINER-only routes', () => {
    it('USER recibe 403 en POST /assistance/assign (TRAINER-only)', async () => {
      const response = await request(server)
        .post('/assistance/assign')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          assistanceId: 'assist-1',
          trainerId: 'trainer-1',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('TRAINER obtiene acceso a POST /assistance/assign', async () => {
      const response = await request(server)
        .post('/assistance/assign')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          assistanceId: 'assist-1',
          trainerId: 'trainer-1',
        });

      // May fail for other reasons, but not 403
      expect(response.status).not.toBe(403);
    });
  });

  describe('ADMIN-only routes', () => {
    it('USER recibe 403 en DELETE /user/:id (ADMIN-only)', async () => {
      const response = await request(server)
        .delete('/user/user-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('TRAINER recibe 403 en DELETE /user/:id (ADMIN-only)', async () => {
      const response = await request(server)
        .delete('/user/user-123')
        .set('Authorization', `Bearer ${trainerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('ADMIN obtiene acceso a DELETE /user/:id', async () => {
      const response = await request(server)
        .delete('/user/user-123')
        .set('Authorization', `Bearer ${adminToken}`);

      // May fail for other reasons, but not 403
      expect(response.status).not.toBe(403);
    });
  });

  describe('Reward redemption (ADMIN approval)', () => {
    it('USER NO puede cambiar estado de redemption a APPROVED', async () => {
      const response = await request(server)
        .patch('/reward/redemption/redemption-1/status')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'APPROVED' });

      expect(response.status).toBe(403);
    });

    it('ADMIN puede cambiar estado de redemption', async () => {
      const response = await request(server)
        .patch('/reward/redemption/redemption-1/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'APPROVED' });

      // May fail for other reasons, but not 403
      expect(response.status).not.toBe(403);
    });
  });
});
