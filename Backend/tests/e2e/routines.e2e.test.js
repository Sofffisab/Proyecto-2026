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

describe('Routines E2E', () => {
  let server;
  let userToken;
  let trainerToken;

  beforeAll(() => {
    server = app.listen(3008);
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

    const trainerRes = await request(server)
      .post('/auth/register')
      .send({
        email: `trainer-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'Trainer',
        lastName: 'Coach',
      });
    trainerToken = trainerRes.body.data.accessToken;
  });

  it('POST /routines creates a custom routine for the caller', async () => {
    const response = await request(server)
      .post('/routines')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Push day', content: { exercises: ['bench press'] } });

    expect(response.status).toBe(201);
    expect(response.body.data.name).toBe('Push day');
  });

  it('GET /routines only returns the caller\'s own routines', async () => {
    await request(server)
      .post('/routines')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Leg day', content: {} });

    const response = await request(server)
      .get('/routines')
      .set('Authorization', `Bearer ${trainerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(0);
  });

  it('rejects updating a routine that belongs to a different user', async () => {
    const createRes = await request(server)
      .post('/routines')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Push day', content: {} });

    const response = await request(server)
      .put(`/routines/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ name: 'Hijacked' });

    expect(response.status).toBe(403);
  });

  it('PATCH /routines/:id/day/:dayIndex marks a day complete and awards points', async () => {
    const createRes = await request(server)
      .post('/routines')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Push day', content: {} });

    const response = await request(server)
      .patch(`/routines/${createRes.body.data.id}/day/1`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.success).toBe(true);
  });

  it('DELETE /routines/:id removes the routine', async () => {
    const createRes = await request(server)
      .post('/routines')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'To delete', content: {} });

    const deleteRes = await request(server)
      .delete(`/routines/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(deleteRes.status).toBe(200);

    const getRes = await request(server)
      .get(`/routines/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(getRes.status).toBe(404);
  });

  describe('Routine requests (trainer flow)', () => {
    it('a user requests a routine, a trainer accepts and later completes it', async () => {
      const requestRes = await request(server)
        .post('/routines/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});
      expect(requestRes.status).toBe(201);
      expect(requestRes.body.data.status).toBe('PENDING');

      const requestId = requestRes.body.data.id;

      const acceptRes = await request(server)
        .patch(`/routines/requests/${requestId}/accept`)
        .set('Authorization', `Bearer ${trainerToken}`);
      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.data.status).toBe('ACCEPTED');

      const completeRes = await request(server)
        .patch(`/routines/requests/${requestId}/complete`)
        .set('Authorization', `Bearer ${trainerToken}`);
      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.status).toBe('COMPLETED');
    });

    it('rejects completing a request that was never accepted', async () => {
      const requestRes = await request(server)
        .post('/routines/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      const response = await request(server)
        .patch(`/routines/requests/${requestRes.body.data.id}/complete`)
        .set('Authorization', `Bearer ${trainerToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('a different trainer cannot complete a request accepted by someone else', async () => {
      const requestRes = await request(server)
        .post('/routines/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      await request(server)
        .patch(`/routines/requests/${requestRes.body.data.id}/accept`)
        .set('Authorization', `Bearer ${trainerToken}`);

      const otherTrainerRes = await request(server)
        .post('/auth/register')
        .send({
          email: `trainer2-${Date.now()}@example.com`,
          password: 'SecurePassword123!',
          firstName: 'Trainer',
          lastName: 'Two',
        });

      const response = await request(server)
        .patch(`/routines/requests/${requestRes.body.data.id}/complete`)
        .set('Authorization', `Bearer ${otherTrainerRes.body.data.accessToken}`);

      expect(response.status).toBe(403);
    });
  });
});
