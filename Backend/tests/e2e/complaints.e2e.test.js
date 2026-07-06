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

describe('Complaints E2E', () => {
  let server;
  let reporterToken;
  let reportedUserId;
  let adminToken;

  beforeAll(() => {
    server = app.listen(3012);
  });

  afterAll(async () => {
    server.close();
  });

  beforeEach(async () => {
    const reporterRes = await request(server)
      .post('/auth/register')
      .send({
        email: `reporter-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'Reporter',
        lastName: 'User',
      });
    reporterToken = reporterRes.body.data.accessToken;

    const reportedRes = await request(server)
      .post('/auth/register')
      .send({
        email: `reported-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'Reported',
        lastName: 'User',
      });
    reportedUserId = reportedRes.body.data.user.id;

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

  it('POST /complaints creates a pending complaint against another user', async () => {
    const response = await request(server)
      .post('/complaints')
      .set('Authorization', `Bearer ${reporterToken}`)
      .send({ reportedUserId, reason: 'Inappropriate behavior' });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('PENDING');
    expect(response.body.data.reportedUserId).toBe(reportedUserId);
  });

  it('rejects a complaint against a non-existent user', async () => {
    const response = await request(server)
      .post('/complaints')
      .set('Authorization', `Bearer ${reporterToken}`)
      .send({ reportedUserId: '11111111-1111-4111-8111-111111111111', reason: 'Test' });

    expect(response.status).toBe(500);
  });

  it('a regular USER cannot list all complaints (403)', async () => {
    const response = await request(server)
      .get('/complaints')
      .set('Authorization', `Bearer ${reporterToken}`);

    expect(response.status).toBe(403);
  });

  it('GET /complaints/me only returns the caller\'s own complaints', async () => {
    await prisma.complaint.create({
      data: { reporterId: 'someone-else', reportedUserId, reason: 'x', status: 'PENDING' },
    });
    await request(server)
      .post('/complaints')
      .set('Authorization', `Bearer ${reporterToken}`)
      .send({ reportedUserId, reason: 'Mine' });

    const response = await request(server)
      .get('/complaints/me')
      .set('Authorization', `Bearer ${reporterToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].reason).toBe('Mine');
  });

  it('an ADMIN can approve a complaint, applying a point penalty to the reported user', async () => {
    const created = await request(server)
      .post('/complaints')
      .set('Authorization', `Bearer ${reporterToken}`)
      .send({ reportedUserId, reason: 'Bad behavior' });

    const response = await request(server)
      .patch(`/complaints/${created.body.data.id}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('APPROVED');
  });

  it('an ADMIN can reject a complaint', async () => {
    const created = await request(server)
      .post('/complaints')
      .set('Authorization', `Bearer ${reporterToken}`)
      .send({ reportedUserId, reason: 'Unfounded' });

    const response = await request(server)
      .patch(`/complaints/${created.body.data.id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('REJECTED');
  });

  it('a regular USER cannot approve complaints (403)', async () => {
    const created = await request(server)
      .post('/complaints')
      .set('Authorization', `Bearer ${reporterToken}`)
      .send({ reportedUserId, reason: 'Bad behavior' });

    const response = await request(server)
      .patch(`/complaints/${created.body.data.id}/resolve`)
      .set('Authorization', `Bearer ${reporterToken}`);

    expect(response.status).toBe(403);
  });
});
