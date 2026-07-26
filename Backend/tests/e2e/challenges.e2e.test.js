import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createUserAndLogin } from '../helpers/testAuth.js';

vi.mock('../../src/config/prisma.js', async () => {
  const { createE2EPrismaMock } = await import('../helpers/e2ePrismaMock.js');
  return { default: createE2EPrismaMock({ autoOpenGymSessions: true }) };
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
const prisma = (await import('../../src/config/prisma.js')).default;

describe('Challenges E2E', () => {
  let server;
  let token1;
  let token2;
  let userId1;
  let userId2;

  beforeAll(() => {
    server = app.listen(3004);
  });

  afterAll(async () => {
    server.close();
  });

  beforeEach(async () => {
    const user1Res = await createUserAndLogin(server, prisma, {
      email: `user1-${Date.now()}@example.com`,
      firstName: 'User',
      lastName: 'One',
    });
    token1 = user1Res.accessToken;
    userId1 = user1Res.userId;

    const user2Res = await createUserAndLogin(server, prisma, {
      email: `user2-${Date.now()}@example.com`,
      firstName: 'User',
      lastName: 'Two',
    });
    token2 = user2Res.accessToken;
    userId2 = user2Res.userId;
  });

  // Challenges are never created on user request — the app assigns them
  // automatically (popup-style, see jobs/challenge.job.js). There is no
  // POST /challenges endpoint for users to call.
  it('does not expose a POST /challenges endpoint', async () => {
    const response = await request(server)
      .post('/challenges')
      .set('Authorization', `Bearer ${token1}`)
      .send({ userIdA: userId1, userIdB: userId2, station: 'Treadmill' });

    expect(response.status).toBe(404);
  });

  it('PATCH /challenges/:id/join the recipient accepts a system-assigned challenge', async () => {
    const challenge = await prisma.socialChallenge.create({
      data: { userId: userId1, partnerUserId: userId2, station: 'Treadmill', status: 'ASSIGNED' },
    });

    const joinRes = await request(server)
      .patch(`/challenges/${challenge.id}/join`)
      .set('Authorization', `Bearer ${token2}`);

    expect(joinRes.status).toBe(200);
    expect(joinRes.body.success).toBe(true);
  });

  it('rejects accepting the same challenge twice', async () => {
    const challenge = await prisma.socialChallenge.create({
      data: { userId: userId1, partnerUserId: userId2, station: 'Treadmill', status: 'ASSIGNED' },
    });

    await request(server)
      .patch(`/challenges/${challenge.id}/join`)
      .set('Authorization', `Bearer ${token2}`);

    const response = await request(server)
      .patch(`/challenges/${challenge.id}/join`)
      .set('Authorization', `Bearer ${token2}`);

    expect(response.status).not.toBe(200);
    expect(response.body.success).toBe(false);
  });

  it('GET /challenges/active lists the system-assigned challenge for a participant', async () => {
    await prisma.socialChallenge.create({
      data: { userId: userId1, partnerUserId: userId2, station: 'Treadmill', status: 'ASSIGNED' },
    });

    const response = await request(server)
      .get('/challenges/active')
      .set('Authorization', `Bearer ${token1}`);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
  });
});
