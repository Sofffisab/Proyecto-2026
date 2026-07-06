import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../src/config/prisma.js', async () => {
  const { createE2EPrismaMock } = await import('../helpers/e2ePrismaMock.js');
  return { default: createE2EPrismaMock() };
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

describe('Sync E2E', () => {
  let server;
  let token;
  let userId;

  beforeAll(() => {
    server = app.listen(3010);
  });

  afterAll(async () => {
    server.close();
  });

  beforeEach(async () => {
    const res = await request(server)
      .post('/auth/register')
      .send({
        email: `sync-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'Sync',
        lastName: 'User',
      });
    token = res.body.data.accessToken;
    userId = res.body.data.user.id;
  });

  it('processes a full offline batch (checkin -> machineStart -> machineEnd -> checkout) in order', async () => {
    const now = Date.now();
    const t1 = new Date(now - 40 * 60 * 1000).toISOString();
    const t2 = new Date(now - 35 * 60 * 1000).toISOString();
    const t3 = new Date(now - 10 * 60 * 1000).toISOString();
    const t4 = new Date(now - 5 * 60 * 1000).toISOString();

    const machineId = '11111111-1111-4111-8111-111111111111';

    const response = await request(server)
      .post('/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({
        actions: [
          { type: 'checkin', timestamp: t1 },
          { type: 'machineStart', timestamp: t2, payload: { machineId } },
          { type: 'machineEnd', timestamp: t3, payload: { machineId } },
          { type: 'checkout', timestamp: t4 },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.results).toHaveLength(4);
    for (const result of response.body.results) {
      expect(result.success).toBe(true);
    }

    const checkoutResult = response.body.results.find((r) => r.type === 'checkout');
    expect(checkoutResult.data.durationMinutes).toBeGreaterThan(0);

    const machineEndResult = response.body.results.find((r) => r.type === 'machineEnd');
    expect(machineEndResult.data.durationMinutes).toBeGreaterThanOrEqual(0);
  });

  it('rejects a batch with a future timestamp for that action without aborting the others', async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const valid = new Date(Date.now() - 60 * 1000).toISOString();

    const response = await request(server)
      .post('/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({
        actions: [
          { type: 'checkin', timestamp: future },
          { type: 'checkin', timestamp: valid },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.results[0]).toMatchObject({
      type: 'checkin',
      success: false,
      error: 'Timestamp is in the future',
    });
    expect(response.body.results[1].success).toBe(true);
  });

  it('rejects a batch action with a timestamp older than 7 days', async () => {
    const tooOld = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

    const response = await request(server)
      .post('/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ actions: [{ type: 'checkin', timestamp: tooOld }] });

    expect(response.status).toBe(200);
    expect(response.body.results[0]).toMatchObject({
      type: 'checkin',
      success: false,
      error: 'Timestamp is too old (> 7 days)',
    });
  });

  it('a checkout with no open session succeeds with null data instead of failing the batch', async () => {
    const response = await request(server)
      .post('/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ actions: [{ type: 'checkout', timestamp: new Date().toISOString() }] });

    expect(response.status).toBe(200);
    expect(response.body.results[0]).toMatchObject({
      type: 'checkout',
      success: true,
      data: null,
    });
  });

  it('rejects requests without a valid auth token', async () => {
    const response = await request(server)
      .post('/sync')
      .send({ actions: [{ type: 'checkin', timestamp: new Date().toISOString() }] });

    expect(response.status).toBe(401);
  });

  it('rejects an empty actions array via schema validation', async () => {
    const response = await request(server)
      .post('/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ actions: [] });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });
});
