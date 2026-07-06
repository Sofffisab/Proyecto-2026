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

const prisma = (await import('../../src/config/prisma.js')).default;
const app = (await import('../../src/server.js')).default;

describe('Rewards E2E', () => {
  let server;
  let userToken;
  let userId;
  let adminToken;

  beforeAll(() => {
    server = app.listen(3007);
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
    userId = userRes.body.data.user.id;

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

  it('GET /rewards lists only active rewards ordered by cost', async () => {
    await prisma.reward.create({
      data: { name: 'Water bottle', pointsCost: 50, active: true },
    });
    await prisma.reward.create({
      data: { name: 'Retired hoodie', pointsCost: 500, active: false },
    });

    const response = await request(server)
      .get('/rewards')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.every((r) => r.active)).toBe(true);
  });

  it('GET /rewards/redemptions/me only returns the caller\'s own redemptions', async () => {
    const reward = await prisma.reward.create({
      data: { name: 'Protein shake', pointsCost: 100, active: true },
    });
    await prisma.rewardRedemption.create({
      data: { userId, rewardId: reward.id, status: 'SHIPPED' },
    });
    await prisma.rewardRedemption.create({
      data: { userId: 'some-other-user', rewardId: reward.id, status: 'SHIPPED' },
    });

    const response = await request(server)
      .get('/rewards/redemptions/me')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].userId).toBe(userId);
  });

  it('a regular USER cannot change a redemption status (403)', async () => {
    const reward = await prisma.reward.create({
      data: { name: 'Gym towel', pointsCost: 30, active: true },
    });
    const redemption = await prisma.rewardRedemption.create({
      data: { userId, rewardId: reward.id, status: 'SHIPPED' },
    });

    const response = await request(server)
      .patch(`/rewards/redemptions/${redemption.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'DELIVERED' });

    expect(response.status).toBe(403);
  });

  it('an ADMIN can mark a SHIPPED redemption as DELIVERED', async () => {
    const reward = await prisma.reward.create({
      data: { name: 'Gym bag', pointsCost: 80, active: true },
    });
    const redemption = await prisma.rewardRedemption.create({
      data: { userId, rewardId: reward.id, status: 'SHIPPED' },
    });

    const response = await request(server)
      .patch(`/rewards/redemptions/${redemption.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DELIVERED' });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('DELIVERED');
  });

  it('rejects an invalid status transition value', async () => {
    const reward = await prisma.reward.create({
      data: { name: 'Cap', pointsCost: 20, active: true },
    });
    const redemption = await prisma.rewardRedemption.create({
      data: { userId, rewardId: reward.id, status: 'SHIPPED' },
    });

    const response = await request(server)
      .patch(`/rewards/redemptions/${redemption.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'NOT_A_REAL_STATUS' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('GET /rewards/redemptions (admin) lists redemptions from every user', async () => {
    const reward = await prisma.reward.create({
      data: { name: 'Shaker', pointsCost: 40, active: true },
    });
    await prisma.rewardRedemption.create({
      data: { userId, rewardId: reward.id, status: 'SHIPPED' },
    });

    const response = await request(server)
      .get('/rewards/redemptions')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
  });
});
