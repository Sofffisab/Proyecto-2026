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

describe('Notifications E2E', () => {
  let server;
  let userToken;
  let userId;
  let otherUserId;

  beforeAll(() => {
    server = app.listen(3011);
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

    const otherRes = await request(server)
      .post('/auth/register')
      .send({
        email: `other-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'Other',
        lastName: 'User',
      });
    otherUserId = otherRes.body.data.user.id;
  });

  it('GET /notifications only returns the caller\'s own notifications', async () => {
    // Registration asynchronously fires a "Welcome!" notification for the new
    // user (see communication.service.js#sendWelcomeEmail) — give it a tick
    // to land so it doesn't race with the assertions below.
    await new Promise((resolve) => setTimeout(resolve, 20));

    await prisma.notification.create({
      data: { userId, title: 'Mine', body: 'hi', read: false },
    });
    await prisma.notification.create({
      data: { userId: otherUserId, title: 'Not mine', body: 'hi', read: false },
    });

    const response = await request(server)
      .get('/notifications')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    // Every notification returned must belong to the caller — none of the
    // other user's notifications should leak in.
    expect(response.body.data.every((n) => n.userId === userId)).toBe(true);
    expect(response.body.data.some((n) => n.title === 'Mine')).toBe(true);
    expect(response.body.data.some((n) => n.title === 'Not mine')).toBe(false);
  });

  it('GET /notifications/unread-count only counts the caller\'s unread notifications', async () => {
    // Wait for the async post-registration "Welcome!" notification to land
    // so it's included in the baseline count below.
    await new Promise((resolve) => setTimeout(resolve, 20));
    const baseline = await request(server)
      .get('/notifications/unread-count')
      .set('Authorization', `Bearer ${userToken}`);

    await prisma.notification.create({
      data: { userId, title: 'A', body: '', read: false },
    });
    await prisma.notification.create({
      data: { userId, title: 'B', body: '', read: true },
    });

    const response = await request(server)
      .get('/notifications/unread-count')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    // Only 'A' (unread) should add to the count — 'B' is already read.
    expect(response.body.data.count).toBe(baseline.body.data.count + 1);
  });

  it('PATCH /notifications/:id/read marks the notification as read', async () => {
    const notification = await prisma.notification.create({
      data: { userId, title: 'A', body: '', read: false },
    });

    const response = await request(server)
      .patch(`/notifications/${notification.id}/read`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.read).toBe(true);
  });

  it('PATCH /notifications/read-all marks every notification of the caller as read', async () => {
    await prisma.notification.create({ data: { userId, title: 'A', body: '', read: false } });
    await prisma.notification.create({ data: { userId, title: 'B', body: '', read: false } });

    const response = await request(server)
      .patch('/notifications/read-all')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(200);

    const unread = await request(server)
      .get('/notifications/unread-count')
      .set('Authorization', `Bearer ${userToken}`);
    expect(unread.body.data.count).toBe(0);
  });

  it('DELETE /notifications/:id removes the notification', async () => {
    const notification = await prisma.notification.create({
      data: { userId, title: 'A', body: '', read: false },
    });

    const response = await request(server)
      .delete(`/notifications/${notification.id}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(200);
  });

  it('rejects unauthenticated requests with 401', async () => {
    const response = await request(server).get('/notifications');

    expect(response.status).toBe(401);
  });
});
