import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
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

describe('Gamification E2E', () => {
  let server;
  let token;
  let userId;
  let adminToken;

  beforeAll(() => {
    server = app.listen(3011);
  });

  afterAll(async () => {
    server.close();
  });

  beforeEach(async () => {
    const res = await createUserAndLogin(server, prisma, {
      email: `gami-${Date.now()}@example.com`,
      firstName: 'Gami',
      lastName: 'User',
    });
    token = res.accessToken;
    userId = res.userId;

    const adminRes = await createUserAndLogin(server, prisma, {
      email: `admin-${Date.now()}@example.com`,
      firstName: 'Admin',
      lastName: 'Role',
    });
    adminToken = adminRes.accessToken;
  });

  it('GET /gamification/points starts at 0 with no transactions', async () => {
    const response = await request(server)
      .get('/gamification/points')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({ totalPoints: 0, transactions: [] });
  });

  it('a gym check-in awards CHECK_IN points, reflected in GET /gamification/points', async () => {
    await request(server)
      .post('/gym/checkin')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    // addPoints is fired-and-forgotten (non-blocking) inside gymService.checkIn,
    // so give the microtask queue a tick to let the pointTransaction land.
    await new Promise((resolve) => setTimeout(resolve, 50));

    const response = await request(server)
      .get('/gamification/points')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.totalPoints).toBe(10); // POINTS.CHECK_IN
    expect(response.body.data.transactions).toHaveLength(1);
    expect(response.body.data.transactions[0]).toMatchObject({
      userId,
      points: 10,
      reason: 'Gym check-in',
    });
  });

  it('GET /gamification/badges returns an empty list for a user with no unlocked achievements', async () => {
    const response = await request(server)
      .get('/gamification/badges')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual([]);
  });

  it('POST /gamification/review-request creates a pending review request for the caller', async () => {
    const response = await request(server)
      .post('/gamification/review-request')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'My check-in points never showed up' });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      userId,
      reason: 'My check-in points never showed up',
      resolved: false,
    });
  });

  it('rejects a review request with an empty reason', async () => {
    const response = await request(server)
      .post('/gamification/review-request')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: '' });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });

  it('GET /admin/review-requests (ADMIN) lists pending requests with the requesting user attached', async () => {
    const createRes = await request(server)
      .post('/gamification/review-request')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Points look wrong' });
    const requestId = createRes.body.data.id;

    const response = await request(server)
      .get('/admin/review-requests')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    const created = response.body.data.find((r) => r.id === requestId);
    expect(created).toMatchObject({
      userId,
      resolved: false,
      user: expect.objectContaining({ id: userId }),
    });
  });

  it('a non-admin is forbidden from listing review requests', async () => {
    const response = await request(server)
      .get('/admin/review-requests')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it('PATCH /admin/review-requests/:id/resolve (ADMIN) marks a request resolved', async () => {
    const createRes = await request(server)
      .post('/gamification/review-request')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Please review my points' });

    const requestId = createRes.body.data.id;

    const resolveRes = await request(server)
      .patch(`/admin/review-requests/${requestId}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.data).toMatchObject({ id: requestId, resolved: true });
  });

  it('returns 404 when resolving a review request that does not exist', async () => {
    const response = await request(server)
      .patch('/admin/review-requests/00000000-0000-0000-0000-000000000000/resolve')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });
});
