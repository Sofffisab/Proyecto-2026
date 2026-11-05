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

describe('Year Wrapped E2E', () => {
  let server;
  let token;

  beforeAll(() => {
    server = app.listen(3031);
  });

  afterAll(async () => {
    server.close();
  });

  beforeEach(async () => {
    const res = await createUserAndLogin(server, prisma, {
      email: `yearwrapped-${Date.now()}@example.com`,
      firstName: 'Wrapped',
      lastName: 'User',
    });
    token = res.accessToken;
  });

  it('GET /analytics/year-wrapped requires authentication', async () => {
    const response = await request(server).get('/analytics/year-wrapped?year=2026');
    expect(response.status).toBe(401);
  });

  it('GET /analytics/year-wrapped rejects an invalid year', async () => {
    const response = await request(server)
      .get('/analytics/year-wrapped?year=abc')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(400);
  });

  it('GET /analytics/year-wrapped returns the wrapped payload for a user with no activity', async () => {
    const response = await request(server)
      .get('/analytics/year-wrapped?year=2026')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      year: 2026,
      totalPoints: 0,
      friendsMade: 0,
      gymDays: 0,
      machinesUsed: 0,
      distinctRoutines: 0,
      gift: { percent: 50, concept: 'cuota de enero' },
    });
    expect(response.body.data.goalsCompleted).toEqual({ count: 0, items: [] });
  });
});
