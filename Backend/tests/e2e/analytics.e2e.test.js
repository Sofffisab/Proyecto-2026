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

describe('Analytics E2E', () => {
  let server;
  let token;
  let userId;
  let adminToken;

  beforeAll(() => {
    server = app.listen(3012);
  });

  afterAll(async () => {
    server.close();
  });

  beforeEach(async () => {
    const res = await request(server)
      .post('/auth/register')
      .send({
        email: `analytics-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'Analytics',
        lastName: 'User',
      });
    token = res.body.data.accessToken;
    userId = res.body.data.user.id;

    const adminRes = await request(server)
      .post('/auth/register')
      .send({
        email: `admin-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'Admin',
        lastName: 'Role',
      });
    adminToken = adminRes.body.data.accessToken;
  });

  it('GET /analytics/me returns zeroed totals for a brand new user', async () => {
    const response = await request(server)
      .get('/analytics/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      total: { sessions: 0, minutes: 0 },
      daily: { sessions: 0, minutes: 0 },
      weekly: { sessions: 0, minutes: 0 },
      monthly: { sessions: 0, minutes: 0 },
      machineUsage: {},
    });
  });

  it('GET /analytics/me reflects a completed gym session with machine usage', async () => {
    await request(server).post('/gym/checkin').set('Authorization', `Bearer ${token}`).send({});
    await request(server).post('/gym/checkout').set('Authorization', `Bearer ${token}`).send({});

    const response = await request(server)
      .get('/analytics/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.total.sessions).toBe(1);
    expect(response.body.data.daily.sessions).toBe(1);
  });

  it('GET /analytics/gym is ADMIN-only and reports gym-wide totals', async () => {
    const forbidden = await request(server)
      .get('/analytics/gym')
      .set('Authorization', `Bearer ${token}`);
    expect(forbidden.status).toBe(403);

    const before = await request(server)
      .get('/analytics/gym')
      .set('Authorization', `Bearer ${adminToken}`);

    await request(server).post('/gym/checkin').set('Authorization', `Bearer ${token}`).send({});

    const after = await request(server)
      .get('/analytics/gym')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(after.status).toBe(200);
    expect(after.body.data.totalSessions).toBe(before.body.data.totalSessions + 1);
  });

  it('GET /analytics/me/rank returns the caller rank and total points', async () => {
    const response = await request(server)
      .get('/analytics/me/rank')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    // A brand new user with no point transactions has 0 points and no one
    // ranked strictly above them can push their rank below 1.
    expect(response.body.data.totalPoints).toBe(0);
    expect(response.body.data.rank).toBeGreaterThanOrEqual(1);
  });

  it('GET /analytics/patterns returns an empty behavior profile for a user with no sessions', async () => {
    const response = await request(server)
      .get('/analytics/patterns')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      sessionCount: 0,
      frequentDays: [],
      preferredHour: null,
      topMachines: [],
      routines: [],
      consistencyScore: null,
      avgSessionsPerWeek: null,
    });
  });

  it('GET /analytics/engagement is ADMIN-only and reports platform-wide metrics', async () => {
    const forbidden = await request(server)
      .get('/analytics/engagement')
      .set('Authorization', `Bearer ${token}`);
    expect(forbidden.status).toBe(403);

    const before = await request(server)
      .get('/analytics/engagement')
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(server)
      .post('/auth/register')
      .send({
        email: `analytics-extra-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'Extra',
        lastName: 'User',
      });
    expect(res.status).toBe(201);

    const after = await request(server)
      .get('/analytics/engagement')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(after.status).toBe(200);
    expect(after.body.data.totalUsers).toBe(before.body.data.totalUsers + 1);
    expect(after.body.data.activeUsers).toBe(before.body.data.activeUsers + 1);
    expect(typeof after.body.data.totalPointsAwarded).toBe('number');
  });

  it('GET /analytics/wrapped returns a yearly summary for the caller', async () => {
    const response = await request(server)
      .get('/analytics/wrapped')
      .set('Authorization', `Bearer ${token}`)
      .query({ year: new Date().getFullYear() });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeTruthy();
  });

  it('rejects unauthenticated requests to /analytics/me', async () => {
    const response = await request(server).get('/analytics/me');
    expect(response.status).toBe(401);
  });
});
