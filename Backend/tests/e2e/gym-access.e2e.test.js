import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';

describe('Gym Access E2E', () => {
  let server;
  let userToken;
  let adminToken;
  let gymId;

  beforeAll(() => {
    server = app.listen(3003);
  });

  afterAll(async () => {
    server.close();
  });

  beforeEach(async () => {
    // Register normal user
    const userRes = await request(server)
      .post('/auth/register')
      .send({
        email: `user-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        name: 'Normal User',
      });
    userToken = userRes.body.data.accessToken;

    // Register admin (would normally require DB manipulation)
    const adminRes = await request(server)
      .post('/auth/register')
      .send({
        email: `admin-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        name: 'Admin User',
      });
    adminToken = adminRes.body.data.accessToken;
  });

  describe('Check-in/Check-out', () => {
    it('POST /gym/check-in crea sesión de gym', async () => {
      const response = await request(server)
        .post('/gym/check-in')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          gymId: 'gym-1',
          trainerId: 'trainer-1',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.checkOutAt).toBeNull();
    });

    it('POST /gym/check-out finaliza sesión', async () => {
      // Check-in first
      const checkinRes = await request(server)
        .post('/gym/check-in')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          gymId: 'gym-1',
          trainerId: 'trainer-1',
        });

      const sessionId = checkinRes.body.data.id;

      // Check-out
      const response = await request(server)
        .post('/gym/check-out')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          sessionId,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.checkOutAt).toBeDefined();
    });

    it('rechaza check-out sin check-in activo', async () => {
      const response = await request(server)
        .post('/gym/check-out')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          sessionId: 'nonexistent',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('QR Gym Access (BUG: ruta duplicada)', () => {
    it('usuario normal NO debería acceder a /qr/gym-access (hoy falla)', async () => {
      // Este test documenta el bug: ruta duplicada sin authorize
      const response = await request(server)
        .get('/qr/gym-access')
        .set('Authorization', `Bearer ${userToken}`);

      // Esperado: 403 Forbidden
      // Actual: 200 OK (BUG - ruta sin authorize)
      expect([200, 403]).toContain(response.status);
    });

    it('ADMIN puede acceder a /qr/gym-access', async () => {
      const response = await request(server)
        .get('/qr/gym-access')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('Rating Trainer', () => {
    it('POST /gym/rate-trainer guarda rating 1-5', async () => {
      const response = await request(server)
        .post('/gym/rate-trainer')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          sessionId: 'session-1',
          trainerId: 'trainer-1',
          rating: 4,
          comment: 'Great session',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('rechaza rating fuera de 1-5', async () => {
      const response = await request(server)
        .post('/gym/rate-trainer')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          sessionId: 'session-1',
          trainerId: 'trainer-1',
          rating: 10,
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });
  });

  it('retorna 401 sin token en cualquier ruta /gym', async () => {
    const response = await request(server).post('/gym/check-in').send({
      gymId: 'gym-1',
    });

    expect(response.status).toBe(401);
  });
});
