import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

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

const app = (await import('../../src/server.js')).default;

describe('QR E2E', () => {
  let server;
  let userToken;
  let adminToken;

  beforeAll(() => {
    server = app.listen(3009);
  });

  afterAll(async () => {
    server.close();
  });

  beforeEach(async () => {
    const userRes = await request(server)
      .post('/auth/register')
      .send({
        email: `user-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'Normal',
        lastName: 'User',
      });
    userToken = userRes.body.data.accessToken;

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

  describe('Personal QR', () => {
    it('GET /qr/me returns a signed, timestamped payload', async () => {
      const response = await request(server)
        .get('/qr/me')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.type).toBe('USER');
      expect(response.body.data.signature).toBeDefined();
      expect(response.body.data.ts).toBeDefined();
    });

    it('requires authentication', async () => {
      const response = await request(server).get('/qr/me');
      expect(response.status).toBe(401);
    });
  });

  describe('Machine management (ADMIN only)', () => {
    it('a regular USER cannot create a machine', async () => {
      const response = await request(server)
        .post('/qr/machines')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Treadmill 1' });

      expect(response.status).toBe(403);
    });

    it('an ADMIN can create a machine with a QR token', async () => {
      const response = await request(server)
        .post('/qr/machines')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Treadmill 1' });

      expect(response.status).toBe(201);
      expect(response.body.data.name).toBe('Treadmill 1');
      expect(response.body.data.qrToken).toBeDefined();
    });

    it('rejects creating a machine without a name', async () => {
      const response = await request(server)
        .post('/qr/machines')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(422);
    });

    it('GET /qr/gym-access lists active machines for ADMIN, blocks USER', async () => {
      await request(server)
        .post('/qr/machines')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Bike 1' });

      const adminRes = await request(server)
        .get('/qr/gym-access')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminRes.status).toBe(200);
      expect(adminRes.body.data.length).toBeGreaterThan(0);

      const userRes = await request(server)
        .get('/qr/gym-access')
        .set('Authorization', `Bearer ${userToken}`);
      expect(userRes.status).toBe(403);
    });

    it('regenerates a machine QR token (new token differs from the original)', async () => {
      const createRes = await request(server)
        .post('/qr/machines')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Rower 1' });
      const originalToken = createRes.body.data.qrToken;
      const machineId = createRes.body.data.id;

      const response = await request(server)
        .patch(`/qr/machines/${machineId}/regenerate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.token).not.toBe(originalToken);
    });

    it('404s when regenerating a machine that does not exist', async () => {
      const response = await request(server)
        .patch('/qr/machines/00000000-0000-0000-0000-000000000000/regenerate')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });

    it('deactivates a machine', async () => {
      const createRes = await request(server)
        .post('/qr/machines')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Elliptical 1' });

      const response = await request(server)
        .delete(`/qr/machines/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.active).toBe(false);
    });
  });

  describe('Scanning a MACHINE QR', () => {
    it('starts a machine usage session on first scan', async () => {
      const createRes = await request(server)
        .post('/qr/machines')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Squat Rack' });
      const machineId = createRes.body.data.id;

      const payload = JSON.stringify({ type: 'MACHINE', machineId });

      const response = await request(server)
        .post('/qr/scan')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ payload });

      expect(response.status).toBe(200);
      expect(response.body.data.machineId).toBe(machineId);
      expect(response.body.data.endedAt).toBeUndefined();
    });

    it('ends the machine usage session on the second scan of the same machine', async () => {
      const createRes = await request(server)
        .post('/qr/machines')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Cable Machine' });
      const machineId = createRes.body.data.id;
      const payload = JSON.stringify({ type: 'MACHINE', machineId });

      await request(server)
        .post('/qr/scan')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ payload });

      const response = await request(server)
        .post('/qr/scan')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ payload });

      expect(response.status).toBe(200);
      expect(response.body.data.endedAt).toBeDefined();
      expect(response.body.data.durationMinutes).toBeDefined();
    });

    it('rejects a malformed payload', async () => {
      const response = await request(server)
        .post('/qr/scan')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ payload: 'not-json' });

      expect(response.status).not.toBe(200);
      expect(response.body.success).toBe(false);
    });
  });
});
